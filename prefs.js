import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const POSITIONS = [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']];

// All canonical zones from tzdata, sorted, plus UTC.
function loadZones() {
    const zones = new Set(['UTC']);
    try {
        const [, bytes] = GLib.file_get_contents('/usr/share/zoneinfo/zone1970.tab');
        for (const line of new TextDecoder().decode(bytes).split('\n')) {
            if (!line || line.startsWith('#'))
                continue;
            const id = line.split('\t')[2];
            if (id)
                zones.add(id);
        }
    } catch (e) {
        console.warn(`second-clock: cannot read zone1970.tab: ${e.message}`);
    }
    return [...zones].sort();
}

export default class SecondClockPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- Clock -----------------------------------------------------------
        const clock = new Adw.PreferencesGroup({title: 'Clock'});
        page.add(clock);

        let zones = loadZones();
        const current = settings.get_string('timezone');
        if (!zones.includes(current))
            zones = [current, ...zones];

        const tzRow = new Adw.ComboRow({
            title: 'Timezone',
            model: Gtk.StringList.new(zones),
            enable_search: true,
            expression: Gtk.PropertyExpression.new(Gtk.StringObject, null, 'string'),
            selected: zones.indexOf(current),
        });
        tzRow.connect('notify::selected', () => {
            const id = zones[tzRow.selected];
            if (id)
                settings.set_string('timezone', id);
        });
        clock.add(tzRow);

        const labelRow = new Adw.EntryRow({
            title: 'Label (empty = city name)',
            text: settings.get_string('label'),
        });
        labelRow.connect('changed', () => settings.set_string('label', labelRow.text));
        clock.add(labelRow);

        const formatRow = new Adw.EntryRow({
            title: 'Time format (%H:%M, %I:%M %p, %a %H:%M, %H:%M:%S …)',
            text: settings.get_string('format'),
        });
        formatRow.connect('changed', () => settings.set_string('format', formatRow.text));
        clock.add(formatRow);

        const preview = new Adw.ActionRow({title: 'Preview'});
        clock.add(preview);
        const updatePreview = () => {
            const id = settings.get_string('timezone');
            const tz = GLib.TimeZone.new_identifier(id) ?? GLib.TimeZone.new_utc();
            const prefix = settings.get_string('label') || id.split('/').pop().replace(/_/g, ' ');
            const time = GLib.DateTime.new_now(tz).format(settings.get_string('format') || '%H:%M') ?? '(invalid format)';
            preview.subtitle = `${prefix} ${time}`;
        };
        const previewId = settings.connect('changed', updatePreview);
        const previewTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            updatePreview();
            return GLib.SOURCE_CONTINUE;
        });
        window.connect('close-request', () => {
            settings.disconnect(previewId);
            GLib.source_remove(previewTimer);
            return false;
        });
        updatePreview();

        // --- Placement -------------------------------------------------------
        const placement = new Adw.PreferencesGroup({title: 'Placement in top bar'});
        page.add(placement);

        const posRow = new Adw.ComboRow({
            title: 'Area',
            model: Gtk.StringList.new(POSITIONS.map(([, name]) => name)),
            selected: Math.max(0, POSITIONS.findIndex(([v]) => v === settings.get_string('position'))),
        });
        posRow.connect('notify::selected', () =>
            settings.set_string('position', POSITIONS[posRow.selected][0]));
        placement.add(posRow);

        const indexRow = Adw.SpinRow.new_with_range(0, 20, 1);
        indexRow.title = 'Order within area';
        indexRow.subtitle = '0 = first; in the centre, 1 = right of the main clock';
        settings.bind('index', indexRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        placement.add(indexRow);
    }
}
