const sessionStorageKey = 'statefulReconnection.uiState';
let isInitialized;

export function init(overlayElem, maxRetries, retryIntervalMilliseconds) {
    if (isInitialized) {
        throw new Error('Do not add more than one instance of <StatefulReconnection.Enable>');
    }

    isInitialized = true;
    loadUIState();

    Blazor.defaultReconnectionHandler._reconnectionDisplay = new BetterReconnectionDisplay(overlayElem);

    const origOnConnectionDown = Blazor.defaultReconnectionHandler.onConnectionDown;
    Blazor.defaultReconnectionHandler.onConnectionDown = function(options, error) {
        saveUIState();
        options.retryIntervalMilliseconds = retryIntervalMilliseconds;
        options.maxRetries = maxRetries;
        return origOnConnectionDown.call(this, options, error);
    }

    const origOnConnectionUp = Blazor.defaultReconnectionHandler.onConnectionUp;
    Blazor.defaultReconnectionHandler.onConnectionUp = function() {
        clearUIState();
        return origOnConnectionUp.apply(this, arguments);
    }
}

class BetterReconnectionDisplay {
    constructor(overlayElem) {
        this.overlayElem = overlayElem;
    }

    show() {
        this.overlayElem.classList.add('reconnect-visible');
    }

    update(currentAttempt) {
        
    }

    hide() {
        this.overlayElem.classList.remove('reconnect-visible');
    }

    failed() {
        location.reload();
    }

    rejected() {
        location.reload();
    }
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
        
        if (state.__activeElement) {
            const activeElem = document.querySelector(state.__activeElement);
            if (activeElem) {
                activeElem.focus();
            }
        }
    }
}

function saveUIState() {
    const editableElements = document.querySelectorAll(['input:not([type=radio])', 'textarea', 'select']);
    const radioButtons = document.querySelectorAll('input[type=radio]');
    const selectorCacheMap = new Map();
    const uiState = {};

    editableElements.forEach(elem => {
        const selector = toQuerySelector(elem, selectorCacheMap);
        uiState[selector] = readElementValue(elem);
    });

    const radioGroups = {};
    radioButtons.forEach(radioButton => {
        const name = radioButton.name;
        if (!radioGroups[name]) {
            radioGroups[name] = [];
        }
        radioGroups[name].push(radioButton);
    });
    Object.values(radioGroups).forEach(group => {
        const checkedRadioButton = group.find(radioButton => radioButton.checked);
        if (checkedRadioButton) {
            const selector = toQuerySelector(checkedRadioButton, selectorCacheMap);
            uiState[selector] = readElementValue(checkedRadioButton);
        }
    });

    if (document.activeElement) {
        uiState.__activeElement = toQuerySelector(document.activeElement, selectorCacheMap);
    }

    sessionStorage.setItem(sessionStorageKey, JSON.stringify(uiState));
}

function clearUIState() {
    sessionStorage.removeItem(sessionStorageKey);
}

function toQuerySelector(elem, cacheMap) {
    if (cacheMap.has(elem)) {
        return cacheMap.get(elem);
    }

    let result;

    if (elem.id) {
        result = `#${elem.id}`; // No need to recurse into ancestors in this case
    } else {
        let nthOfTypeIndex = 1;
        let sibling = elem.parentNode.firstElementChild;
        while (sibling !== elem) {
            if (sibling.tagName === elem.tagName) {
                nthOfTypeIndex++;
            }
            sibling = sibling.nextElementSibling;
        }


        const selector = `${elem.tagName}:nth-of-type(${nthOfTypeIndex})`;
        result = elem === document.documentElement ? selector : `${toQuerySelector(elem.parentNode, cacheMap)} > ${selector}`;
    }

    cacheMap.set(elem, result);
    return result;
}

function readElementValue(elem) {
    if (elem.type === 'checkbox') {
        return elem.checked;
    } else if (elem.type === 'radio') {
        return elem.checked ? elem.value : null;
    } else {
        return elem.value;
    }
}

function writeElementValue(elem, value) {
    if (elem.type === 'checkbox') {
        elem.checked = value;
    } else if (elem.type === 'radio') {
        elem.checked = (elem.value === value);
    } else {
        elem.value = value;
    }

    elem.dispatchEvent(new Event('input', { 'bubbles': true }));
    elem.dispatchEvent(new Event('change', { 'bubbles': true }));
}
