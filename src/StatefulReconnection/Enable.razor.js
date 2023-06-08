const sessionStorageKey = 'statefulReconnection.uiState';

export function init() {
    loadUIState();

    const origOnConnectionDown = Blazor.defaultReconnectionHandler.onConnectionDown;
    Blazor.defaultReconnectionHandler.onConnectionDown = function() {
        saveUIState();
        return origOnConnectionDown.apply(this, arguments);
    }

    const origOnConnectionUp = Blazor.defaultReconnectionHandler.onConnectionUp;
    Blazor.defaultReconnectionHandler.onConnectionUp = function() {
        clearUIState();
        return origOnConnectionUp.apply(this, arguments);
    }

    // TODO: Remove this. It's only for testing. We should only store the state when Blazor says a connection was lost.
    //saveUIState();
}

function loadUIState() {
    const stateJson = sessionStorage.getItem(sessionStorageKey);
    if (stateJson) {
        clearUIState();
        const state = JSON.parse(stateJson);
        for (const [selector, value] of Object.entries(state)) {
            const elem = document.querySelector(selector);
            if (elem) {
                writeElementValue(elem, value);
            }
        }
    }
}

function saveUIState() {
    const editableElements = document.querySelectorAll(['input', 'textarea', 'select']);
    const selectorCacheMap = new Map();
    const uiState = {};
    editableElements.forEach(elem => {
        const selector = toQuerySelector(elem, selectorCacheMap);
        uiState[selector] = readElementValue(elem);
    });

    sessionStorage.setItem(sessionStorageKey, JSON.stringify(uiState));
}

function clearUIState() {
    sessionStorage.removeItem(sessionStorageKey);
}

function toQuerySelector(elem, cacheMap) {
    if (cacheMap.has(elem)) {
        return cacheMap.get(elem);
    }

    let nthOfTypeIndex = 1;
    let sibling = elem.parentNode.firstElementChild;
    while (sibling !== elem) {
        if (sibling.tagName === elem.tagName) {
            nthOfTypeIndex++;
        }
        sibling = sibling.nextElementSibling;
    }

    const selector = `${elem.tagName}:nth-of-type(${nthOfTypeIndex})`;
    const result = elem === document.documentElement ? selector : `${toQuerySelector(elem.parentNode, cacheMap)} > ${selector}`;
    cacheMap.set(elem, result);
    return result;
}

function readElementValue(elem) {
    // TODO: Handle things other than input
    return elem.value;
}

function writeElementValue(elem, value) {
    // TODO: Handle things other than input
    elem.value = value;
    elem.dispatchEvent(new Event('input', { 'bubbles': true }));
    elem.dispatchEvent(new Event('change', { 'bubbles': true }));
}
