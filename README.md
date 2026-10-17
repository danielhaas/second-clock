# Second Clock

GNOME Shell extension (49/50) that adds a second clock for another timezone to the top bar.
Click it to open the settings: timezone (searchable), label, time format, and position. Changes apply immediately.

## Install

```sh
glib-compile-schemas schemas/
ln -s "$PWD" ~/.local/share/gnome-shell/extensions/second-clock@local
# log out and back in (Wayland), then:
gnome-extensions enable second-clock@local
```

After editing `extension.js`, log out and back in (Wayland). Changes to `prefs.js` show up the next time the settings window opens.
