(function () {
    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    async function fetchTextSequentially(candidates) {
        for (var i = 0; i < candidates.length; i += 1) {
            try {
                var response = await fetch(candidates[i], { cache: "no-store" });
                if (response.ok) {
                    return await response.text();
                }
            } catch (error) {
                // Try next candidate
            }
        }
        throw new Error("Failed to load game script.");
    }

    function executeScriptText(scriptText) {
        return new Promise(function (resolve, reject) {
            try {
                var inlineScript = document.createElement("script");
                inlineScript.text = "(function(){\n" + scriptText + "\n})();";
                document.body.appendChild(inlineScript);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    window.createUnityInstance = async function (canvas, config, onProgress) {
        if (!canvas) {
            throw new Error("Canvas not found.");
        }

        if (typeof onProgress === "function") onProgress(0.15);
        await sleep(100);
        if (typeof onProgress === "function") onProgress(0.4);

        var frameworkUrl = (config && config.frameworkUrl) || "Build/deji_2dRun.framework.js.gz";
        var frameworkText = await fetchTextSequentially([
            frameworkUrl,
            "Build/deji_2dRun.framework.js.gz",
            "./Build/deji_2dRun.framework.js.gz"
        ]);
        await executeScriptText(frameworkText);

        if (typeof onProgress === "function") onProgress(0.9);
        await sleep(100);
        if (typeof onProgress === "function") onProgress(1);

        return {
            SetFullscreen: function () {}
        };
    };
})();
