export function init() {
    const origOnConnectionDown = Blazor.defaultReconnectionHandler.onConnectionDown;

    Blazor.defaultReconnectionHandler.onConnectionDown = function() {
        return origOnConnectionDown.apply(this, arguments);
    }
}
