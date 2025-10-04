function checkForUpdate() {
    if (api.hasPreferenceObject(SCRIPT_KEY)) {
        const prefs = api.getPreferenceObject(SCRIPT_KEY);
        const now = new Date().getTime();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        if (prefs.newVersionAvailable == true) {
            console.log("New version already available: " + prefs.latestVersion);
            return;
        }

        if (prefs.lastCheck > oneDayAgo) {
            return;
        }
    }
    
    
    // Do the version check
    const client = new api.WebClient("https://api.github.com");
    client.get("/repos/phillip-motion/quiver/releases/latest");
    
    if (client.status() == 200) {
        const release = JSON.parse(client.body());
        const latestVersion = release.tag_name;
        var newVersionAvailable = false;
        // Save the check time and version

        if (latestVersion > currentVersion) {
            newVersionAvailable = true;
        }
        
        api.setPreferenceObject(SCRIPT_KEY, {
            lastCheck: new Date().getTime(),
            latestVersion: latestVersion,
            newVersionAvailable: newVersionAvailable
        });
       
    }
}

checkForUpdate();