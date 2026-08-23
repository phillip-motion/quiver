(function () {
    var PIN_NAME = "Glass Anchor (auto)";

    function isPinId(id) {
        if (String(api.getLayerType(id)) !== "backgroundBlurFilter") return false;
        var n = String(api.getNiceName(id));
        return n.indexOf("Glass Anchor") >= 0;
    }

    function isConnectedPin(id, host) {
        var outs = [];
        try { outs = api.getOutConnections(id, "id") || []; } catch (e) { return false; }
        for (var o = 0; o < outs.length; o++) {
            if (String(outs[o]).indexOf(host + ".filters.") === 0) return true;
        }
        return false;
    }
    function hasPin(host) {
        var kids = [];
        try { kids = api.getChildren(host) || []; } catch (e) { return false; }
        for (var i = 0; i < kids.length; i++) {
            if (isPinId(kids[i]) && isConnectedPin(kids[i], host)) return true;
        }
        return false;
    }
    function isDrawable(id) {
        var supers = [];
        try { supers = api.getSuperTypes(id) || []; } catch (e) { return false; }
        for (var s = 0; s < supers.length; s++) { if (String(supers[s]) === "shape") return true; }
        return false;
    }
    function hostFor(id) {
        if (isDrawable(id)) return id;
        var p = null;
        try { p = api.getParent(id); } catch (e) { return null; }
        if (p && isDrawable(p)) return p;
        return null;
    }

    try {

        try {
            var top = api.getChildren(api.getActiveComp()) || [];
            for (var t = 0; t < top.length; t++) {
                if (isPinId(top[t])) { try { api.deleteLayer(top[t]); } catch (eT) {} }
            }
        } catch (eS) {}

        var sel = [];
        try { sel = api.getSelection() || []; } catch (e0) { return; }
        if (sel.length !== 1) return;
        var host = hostFor(sel[0]);
        if (!host) return;
        if (hasPin(host)) return;

        var pin = api.create("backgroundBlurFilter", PIN_NAME);
        if (!pin) return;
        if (!hasPin(host)) {

            var attached = false;
            try {
                var spare = api.addArrayIndex(host, "filters");
                var slot = api.addArrayIndex(host, "filters");
                if (typeof slot === "number" && slot >= 0) {
                    api.connect(pin, "id", host, "filters." + slot);
                    api.parent(pin, host);
                    attached = hasPin(host);
                }
            } catch (e1) { attached = false; }
            if (!attached) {
                try { api.deleteLayer(pin); } catch (e2) {}
                return;
            }
        }

        try { api.set(pin, { "amount.x": 0, "amount.y": 0 }); } catch (e3) {}
        try { api.set(pin, { showInProjectWindow: false, showUIinAtEd: false, locked: true }); } catch (e4) {}
    } catch (e) {  }
})();
