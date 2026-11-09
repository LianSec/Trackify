// Minimales DOM, damit Module, die beim Speichern die Statusanzeige setzen, im Test laufen.
document.body.innerHTML = `<span id="save"></span><div id="banner"></div><section id="view"></section><div id="toast" hidden></div><a id="sosfab"></a><div id="session" hidden></div><a id="account"></a>`;
