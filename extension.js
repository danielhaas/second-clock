import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Default label when the "label" setting is empty: last path component of the
// zone id, e.g. "America/New_York" -> "New York".
function cityName(tzId) {
    return tzId.split('/').pop().replace(/_/g, ' ');
}

const SecondClock = GObject.registerClass(
class SecondClock extends PanelMenu.Button {
    _init(settings, openPrefs) {
        super._init(0.5, 'Second Clock', true);

        this._settings = settings;
        this._label = new St.Label({
            style_class: 'clock',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);

        // Click opens the preferences window.
        this.connect('button-press-event', () => {
            openPrefs();
            return Clutter.EVENT_STOP;
        });

        this._timeoutId = 0;
        this._settingsIds = ['timezone', 'label', 'format'].map(key =>
            this._settings.connect(`changed::${key}`, () => this._reload()));
        this._reload();
    }

    _reload() {
        const tzId = this._settings.get_string('timezone');
        this._tz = GLib.TimeZone.new_identifier(tzId) ?? GLib.TimeZone.new_utc();
        this._prefix = this._settings.get_string('label') || cityName(tzId);
        this._format = this._settings.get_string('format') || '%H:%M';
        this._perSecond = /%[sST]|%[rX]/.test(this._format);
        this._tick();
    }

    _tick() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const now = GLib.DateTime.new_now(this._tz);
        const time = now.format(this._format) ?? '';
        this._label.text = this._prefix ? `${this._prefix} ${time}` : time;

        // Re-fire just after the next minute (or second) boundary so the label stays in sync.
        const delay = this._perSecond ? 1 : Math.max(1, Math.ceil(61 - now.get_seconds()));
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delay, () => {
            this._timeoutId = 0;
            this._tick();
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._settingsIds.forEach(id => this._settings.disconnect(id));
        this._settingsIds = [];
        super.destroy();
    }
});

export default class SecondClockExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._placementIds = ['position', 'index'].map(key =>
            this._settings.connect(`changed::${key}`, () => this._place()));
        this._place();
    }

    // (Re)create the indicator; moving between panel boxes needs a fresh addToStatusArea.
    _place() {
        this._indicator?.destroy();
        this._indicator = new SecondClock(this._settings, () => this.openPreferences());
        Main.panel.addToStatusArea('second-clock', this._indicator,
            this._settings.get_int('index'), this._settings.get_string('position'));
    }

    disable() {
        this._placementIds?.forEach(id => this._settings.disconnect(id));
        this._placementIds = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
