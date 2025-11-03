/**
 * Compare two semantic version strings (e.g., "1.0.0" vs "1.0.1")
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    const parts2 = v2.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    
    for (var i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    
    return 0;
}

function checkForUpdate() {
    if (api.hasPreferenceObject(SCRIPT_KEY)) {
        const prefs = api.getPreferenceObject(SCRIPT_KEY);
        const now = new Date().getTime();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        // Uncomment this to reset the version check
        // api.setPreferenceObject(SCRIPT_KEY, {
        //     lastCheck: null,
        //     latestVersion: null,
        //     newVersionAvailable: false
        // });
        
        if (prefs.newVersionAvailable == true && prefs.lastCheck > oneDayAgo) {
            return;
        }

        
    }
    
    
    // Do the version check
    const client = new api.WebClient("https://api.github.com");
    client.get("/repos/phillip-motion/quiver/releases/latest");
    
    if (client.status() == 200) {
        const release = JSON.parse(client.body());
        let latestVersion = release.tag_name;
        
        // Remove 'v' prefix if present (e.g., "v1.0.0" -> "1.0.0")
        if (latestVersion.startsWith('v')) {
            latestVersion = latestVersion.substring(1);
        }
        
        var newVersionAvailable = false;
        
        // Compare versions properly
        if (compareVersions(latestVersion, currentVersion) > 0) {
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