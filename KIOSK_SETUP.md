# Raspberry Pi Kiosk Setup Guide

This guide covers setting up a Raspberry Pi to run the Medication Kiosk application in a dedicated kiosk mode that auto-starts on boot.

## Prerequisites

- Raspberry Pi 5 (or Pi 4) with Raspberry Pi OS (Bookworm/Trixie)
- Display connected via HDMI
- Network connection for remote management
- MongoDB instance (local or remote) - see [MongoDB installation guide](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-debian/)

## 1. Install Required Packages

```bash
sudo apt update
sudo apt install -y openbox lightdm unclutter chromium nodejs npm
```

## 2. Install and Configure the Application

### Clone the repository
```bash
cd ~
git clone <repository-url> todo
cd todo
```

### Configure environment
Copy the example environment file and edit with your MongoDB settings:
```bash
cp .env.example .env
nano .env
```

Edit the values for your MongoDB instance:
```
MONGO_HOST=localhost        # or your MongoDB server IP
MONGO_PORT=27017
MONGO_USERNAME=admin
MONGO_PASSWORD=your_password_here
MONGO_DATABASE=medication-kiosk
PORT=5177
```

### Install dependencies and build
```bash
npm install
npm run build
```

### Set up PM2 for process management
```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Run the command it outputs (will look like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u <username> --hp /home/<username>
```

## 3. Configure X11 for Raspberry Pi 5

The Pi 5 has two GPU devices - card0 (V3D render-only) and card1 (display). X11 needs to be told to use card1.

Create the X11 configuration:
```bash
sudo mkdir -p /etc/X11/xorg.conf.d
sudo tee /etc/X11/xorg.conf.d/10-gpu.conf << 'EOF'
Section "Device"
    Identifier "GPU"
    Driver "modesetting"
    Option "kmsdev" "/dev/dri/card1"
EndSection

Section "Screen"
    Identifier "Screen0"
    Device "GPU"
EndSection
EOF
```

> **Note:** This step is critical for Pi 5. Without it, X11 may fail to start with "Cannot run in framebuffer mode" or "no screens found" errors.

## 4. Configure LightDM Auto-Login

Create the autologin configuration:
```bash
sudo tee /etc/lightdm/lightdm.conf.d/50-autologin.conf << EOF
[Seat:*]
autologin-user=$USER
autologin-user-timeout=0
user-session=openbox
EOF
```

This uses `$USER` to automatically insert your current username.

## 5. Configure Openbox Autostart

Create the openbox config directory and autostart script:
```bash
mkdir -p ~/.config/openbox
cat > ~/.config/openbox/autostart << 'EOF'
#!/bin/bash

# Disable screen blanking and power management
xset s off
xset s noblank
xset -dpms

# Hide cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Wait for the server to be ready
sleep 5

# Launch Chromium in kiosk mode
chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --start-fullscreen \
    --autoplay-policy=no-user-gesture-required \
    http://localhost:5177 &
EOF

chmod +x ~/.config/openbox/autostart
```

## 6. Create LightDM Data Directory

Prevent warning messages in logs:
```bash
sudo mkdir -p /var/lib/lightdm/data
sudo chown lightdm:lightdm /var/lib/lightdm/data
```

## 7. Reboot and Test

```bash
sudo reboot
```

The Pi should boot directly into the kiosk application.

## Troubleshooting

### Black screen after boot

1. SSH into the Pi and check service status:
   ```bash
   sudo systemctl status lightdm
   pm2 status
   ```

2. Check X11 logs for errors:
   ```bash
   sudo cat /var/log/lightdm/x-0.log | tail -30
   cat /var/log/Xorg.0.log | grep -E "(EE|WW)"
   ```

3. Common fixes:
   - **"Cannot run in framebuffer mode"**: The X11 GPU config is missing or wrong. Re-run step 3.
   - **"no screens found"**: Same as above, or no display connected.
   - **Chromium not starting**: Check if the backend is running with `pm2 status`.

### Restart the display manager
```bash
sudo systemctl restart lightdm
```

### Manually start the kiosk (for testing)
```bash
sudo systemctl stop lightdm
sudo systemctl start lightdm
```

### Check if processes are running
```bash
ps aux | grep -E "(openbox|chromium)" | grep -v grep
```

### View application logs
```bash
pm2 logs todo-backend
```

## Remote Access

### Caregiver Dashboard
Access from any browser on the same network:
```
http://<pi-ip-address>:5177/caregiver
```

### Mirror View
View what the kiosk is displaying:
```
http://<pi-ip-address>:5177/mirror
```

## Configuration Files Summary

| File | Purpose |
|------|---------|
| `/etc/X11/xorg.conf.d/10-gpu.conf` | X11 GPU configuration for Pi 5 |
| `/etc/lightdm/lightdm.conf.d/50-autologin.conf` | Auto-login configuration |
| `~/.config/openbox/autostart` | Kiosk browser launch script |
| `~/todo/ecosystem.config.cjs` | PM2 process configuration |
