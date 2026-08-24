// Check Update from Github
// Usage:
//   1. Create a versions.json file in the root of your repository with the following format:
//      {
//          "scriptName": "1.0.0"
//      }
//   2. Paste this entire code block
//   3. Call the function:
//      // Default (console warning)
//      checkForUpdate(GITHUB_REPO, scriptName, currentVersion);
//
//      // Advanced (UI callback)
//      checkForUpdate(GITHUB_REPO, scriptName, currentVersion, function(updateAvailable, newVersion) {
//          if (updateAvailable) {
//              statusLabel.setText("⚠ Update " + newVersion + " available!");
//          }
//      });

var GITHUB_REPO = "phillip-motion/Quiver";
var scriptName = "Quiver";  // Must match key your repo's versions.json
// var currentVersion = currentVersion;

// Update checking can be switched off in the Settings window. Kept in its own
// preference object so the cached version data written below can't clobber it.
var UPDATE_CHECK_PREF = scriptName + "_update_check_enabled";

function isUpdateCheckEnabled() {
    try {
        if (api.hasPreferenceObject(UPDATE_CHECK_PREF)) {
            var prefs = api.getPreferenceObject(UPDATE_CHECK_PREF);
            return prefs.enabled !== false;
        }
    } catch (e) {}
    return true; // Default: update checking is on
}

function setUpdateCheckEnabled(enabled) {
    try {
        api.setPreferenceObject(UPDATE_CHECK_PREF, { enabled: !!enabled });
    } catch (e) {}
}

function compareVersions(v1, v2) {
    /* Compare two semantic version strings (e.g., "1.0.0" vs "1.0.1") */
    var parts1 = v1.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    var parts2 = v2.split('.').map(function(n) { return parseInt(n, 10) || 0; });
    
    for (var i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        var num1 = parts1[i] || 0;
        var num2 = parts2[i] || 0;
        
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    
    return 0;
}


// How long before we hit the network again. Failed checks are cached too -
// otherwise a machine that can't reach GitHub repeats this blocking request
// on every single launch.
var UPDATE_CHECK_SUCCESS_TTL = 48 * 60 * 60 * 1000; // 48 hours
var UPDATE_CHECK_FAILURE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function _recordUpdateCheck(scriptName, latestVersion, failed) {
    try {
        api.setPreferenceObject(scriptName + "_update_check", {
            lastCheck: new Date().getTime(),
            latestVersion: latestVersion || null,
            lastCheckFailed: !!failed
        });
    } catch (e) {}
}

function checkForUpdate(githubRepo, scriptName, currentVersion, callback, force) {
    // Uncomment below to reset the version check for testing
    // api.setPreferenceObject(scriptName + "_update_check", {
    //     lastCheck: null,
    //     latestVersion: null
    // });

    var now = new Date().getTime();
    var shouldFetchFromGithub = true;
    var cachedLatestVersion = null;

    if (api.hasPreferenceObject(scriptName + "_update_check")) {
        var prefs = api.getPreferenceObject(scriptName + "_update_check");
        cachedLatestVersion = prefs.latestVersion;

        var ttl = prefs.lastCheckFailed ? UPDATE_CHECK_FAILURE_TTL : UPDATE_CHECK_SUCCESS_TTL;
        if (prefs.lastCheck && prefs.lastCheck > (now - ttl)) {
            shouldFetchFromGithub = false;
        }
    }

    // The Settings window's "Check now" button bypasses the backoff window.
    if (force) {
        shouldFetchFromGithub = true;
    }

    // Inside the backoff window - answer from what we already know, no network.
    if (!shouldFetchFromGithub) {
        if (cachedLatestVersion && compareVersions(cachedLatestVersion, currentVersion) > 0) {
            console.warn(scriptName + ' ' + cachedLatestVersion + ' update available (you have ' + currentVersion + '). Download at github.com/' + githubRepo);
            if (callback) callback(true, cachedLatestVersion, false);
        } else {
            if (callback) callback(false, null, false);
        }
        return;
    }

    // Perform the version check
    try {
        var path = "/" + githubRepo + "/main/versions.json";
        var client = new api.WebClient("https://raw.githubusercontent.com");
        client.get(path);

        if (client.status() === 200) {
            var versions = JSON.parse(client.body());
            var latestVersion = versions[scriptName];

            if (!latestVersion) {
                console.warn("Version check: Script name '" + scriptName + "' not found in versions.json");
                _recordUpdateCheck(scriptName, cachedLatestVersion, true);
                if (callback) callback(false, null, true);
                return;
            }

            // Remove 'v' prefix if present (e.g., "v1.0.0" -> "1.0.0")
            if (latestVersion.startsWith('v')) {
                latestVersion = latestVersion.substring(1);
            }

            _recordUpdateCheck(scriptName, latestVersion, false);

            var updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
            if (updateAvailable) {
                console.warn(scriptName + ' ' + latestVersion + ' update available (you have ' + currentVersion + '). Download at github.com/' + githubRepo);
                if (callback) callback(true, latestVersion, false);
            } else {
                if (callback) callback(false, null, false);
            }
        } else {
            _recordUpdateCheck(scriptName, cachedLatestVersion, true);
            if (callback) callback(false, null, true);
        }
    } catch (e) {
        _recordUpdateCheck(scriptName, cachedLatestVersion, true);
        if (callback) callback(false, null, true);
    }
}

// Version check runs automatically unless disabled in Settings
// (stores result in scriptName + "_update_check" preference)
if (isUpdateCheckEnabled()) {
    checkForUpdate(GITHUB_REPO, scriptName, currentVersion);
}

// End update checker