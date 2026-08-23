(function () {
    var PIN_NAME = "Glass Anchor (auto)";
    var GLASS = "jackJaeschke::glass";

    function stackOf(host) {
        var out = [];
        var kids = [];
        try { kids = api.getChildren(host) || []; } catch (e) { return out; }
        for (var i = 0; i < kids.length; i++) {
            out.push({ id: kids[i], type: String(api.getLayerType(kids[i])) });
        }
        return out;
    }

    function isPin(entry) {
        if (entry.type !== "backgroundBlurFilter") return false;
        var n = String(api.getNiceName(entry.id));
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
    function hasGlass(stack) {
        for (var i = 0; i < stack.length; i++) { if (stack[i].type === GLASS) return true; }
        return false;
    }
    function hasPin(stack, host) {
        for (var i = 0; i < stack.length; i++) {
            if (isPin(stack[i]) && isConnectedPin(stack[i].id, host)) return true;
        }
        return false;
    }

    function canHostFilters(id) {
        var t = "";
        try { t = String(api.getLayerType(id)); } catch (e) { return false; }
        if (t === "compNode" || t === "") return false;
        var attrs = [];
        try { attrs = api.getAttributes(id) || []; } catch (e) { return false; }
        for (var i = 0; i < attrs.length; i++) { if (String(attrs[i]) === "filters") return true; }
        return false;
    }
    function addPin(host) {
        if (!canHostFilters(host)) return null;
        var pin = api.create("backgroundBlurFilter", PIN_NAME);
        if (!pin) return null;
        var ok = false;
        try {
            var i = api.addArrayIndex(host, "filters");
            if (typeof i === "number" && i >= 0) {
                api.connect(pin, "id", host, "filters." + i);
                api.parent(pin, host);
                ok = true;
            }
        } catch (e) { ok = false; }
        if (!ok) { try { api.deleteLayer(pin); } catch (e2) {} return null; }
        try { api.set(pin, { "amount.x": 0, "amount.y": 0 }); } catch (e3) {}
        try { api.set(pin, { showInProjectWindow: false, showUIinAtEd: false, locked: true }); } catch (e4) {}
        return pin;
    }

    function rebakeMattes(glass) {
        var empties = 0;
        for (var i = 0; i < 16 && empties < 2; i++) {
            var src = "";
            try { src = String(api.getInConnection(glass, "mattes." + i + ".matteLayer") || ""); }
            catch (e) { break; }
            if (!src) { empties++; continue; }
            empties = 0;
            var matteId = src.split(".")[0];
            try { api.connect(matteId, "id", glass, "mattes." + i + ".matteLayer", true); }
            catch (e2) {}
        }
    }

    try {
        var all = api.getAllSceneLayers() || [];

        for (var j = 0; j < all.length; j++) {
            try {
                if (!canHostFilters(all[j])) continue;
                var stack = stackOf(all[j]);
                if (!stack.length) continue;
                var glass = hasGlass(stack);
                for (var k = 0; k < stack.length; k++) {
                    if (!isPin(stack[k])) continue;
                    if (!glass || !isConnectedPin(stack[k].id, all[j])) {

                        try { api.deleteLayer(stack[k].id); } catch (e1) {}
                    } else {
                        if (String(api.getNiceName(stack[k].id)) !== PIN_NAME) {
                            try { api.rename(stack[k].id, PIN_NAME); } catch (e2) {}
                        }

                        try { api.set(stack[k].id, { showInProjectWindow: false, showUIinAtEd: false, locked: true }); } catch (eF) {}
                    }
                }
                if (glass && !hasPin(stackOf(all[j]), all[j])) addPin(all[j]);
            } catch (e3) {}
        }

        for (var g = 0; g < all.length; g++) {
            try {
                if (String(api.getLayerType(all[g])) === GLASS) rebakeMattes(all[g]);
            } catch (e4) {}
        }

        try {
            var top = api.getChildren(api.getActiveComp()) || [];
            for (var t = 0; t < top.length; t++) {
                var e = { id: top[t], type: String(api.getLayerType(top[t])) };
                if (isPin(e)) { try { api.deleteLayer(e.id); } catch (e5) {} }
            }
        } catch (e6) {}
    } catch (e) {  }
})();
