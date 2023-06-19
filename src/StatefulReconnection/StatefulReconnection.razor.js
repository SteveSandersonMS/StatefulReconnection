const sessionStorageKey = 'statefulReconnection.uiState';
let isInitialized;
let countdownInterval;

export function init(overlayElem, maxRetries, retryIntervalMilliseconds) {
    if (isInitialized) {
        throw new Error('Do not add more than one instance of <StatefulReconnection.Enable>');
    }

    isInitialized = true;
    loadUIState();
    const reconnectionDisplay = new BetterReconnectionDisplay(overlayElem, maxRetries, retryIntervalMilliseconds);
    Blazor.defaultReconnectionHandler._reconnectionDisplay = reconnectionDisplay;

    const origOnConnectionDown = Blazor.defaultReconnectionHandler.onConnectionDown;
    Blazor.defaultReconnectionHandler.onConnectionDown = function (options, error) {
        saveUIState();
        options.retryIntervalMilliseconds = retryIntervalMilliseconds;
        options.maxRetries = maxRetries;

        // If the user has a UI element with id=reconnectRetryMaxAttempts, update it
        const maxAttemptsElem = document.getElementById("reconnectRetryMaxAttempts");
        if (maxAttemptsElem) {
            maxAttemptsElem.textContent = maxRetries;
        }

        // Start countdown timer (exposes countdownInterval to the frontend)
        countdownInterval = setInterval(() => {
            const countdownTimerElem = document.getElementById("reconnectRetryTimeRemaining");

            if (countdownTimerElem) {
                const avgTimePerRetry = Blazor.defaultReconnectionHandler._reconnectionDisplay.retryDurations.length > 0 ? (Blazor.defaultReconnectionHandler._reconnectionDisplay.retryDurations.reduce((a, b) => a + b, 0) / Blazor.defaultReconnectionHandler._reconnectionDisplay.retryDurations.length) : retryIntervalMilliseconds;
                Blazor.defaultReconnectionHandler._reconnectionDisplay.remainingTime = (maxRetries - Blazor.defaultReconnectionHandler._reconnectionDisplay.retryDurations.length) * avgTimePerRetry;

                const hours = Math.floor(Blazor.defaultReconnectionHandler._reconnectionDisplay.remainingTime / 3600000);
                const minutes = Math.floor((Blazor.defaultReconnectionHandler._reconnectionDisplay.remainingTime % 3600000) / 60000);
                const seconds = Math.floor((Blazor.defaultReconnectionHandler._reconnectionDisplay.remainingTime % 60000) / 1000);
                countdownTimerElem.textContent = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

                if (Blazor.defaultReconnectionHandler._reconnectionDisplay.remainingTime < 0) {
                    clearInterval(countdownInterval);
                    countdownTimerElem.textContent = "Timeout";
                }
            }
        }, retryIntervalMilliseconds);

        return origOnConnectionDown.call(this, options, error);
    }

    const origOnConnectionUp = Blazor.defaultReconnectionHandler.onConnectionUp;
    Blazor.defaultReconnectionHandler.onConnectionUp = function() {
        clearUIState();

        // Clear countdown timer
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        return origOnConnectionUp.apply(this, arguments);
    }
}

class BetterReconnectionDisplay {
    constructor(overlayElem, maxRetries, retryIntervalMilliseconds) {
        this.overlayElem = overlayElem;
        this.maxRetries = maxRetries;
        this.retryIntervalMilliseconds = retryIntervalMilliseconds;
        this.retryDurations = [];
        this.lastAttemptTimestamp = null;
        this.remainingTime = maxRetries * retryIntervalMilliseconds;
    }

    show() {
        this.overlayElem.classList.add('reconnect-visible');
    }

    update(currentAttempt) {
        const currentTime = Date.now();

        // Re-calculate remaining time
        if (this.lastAttemptTimestamp !== null) {
            const duration = currentTime - this.lastAttemptTimestamp;
            this.retryDurations.push(duration);
        }
        this.lastAttemptTimestamp = currentTime;
        const avgTimePerRetry = this.retryDurations.length > 0 ? (this.retryDurations.reduce((a, b) => a + b, 0) / this.retryDurations.length) : this.retryIntervalMilliseconds;
        this.remainingTime = (this.maxRetries - currentAttempt) * avgTimePerRetry;

        // If the user has a UI element with id=reconnectRetryCurrentAttempt, update it
        const currentAttemptElem = document.getElementById("reconnectRetryCurrentAttempt");
        if (currentAttemptElem) {
            currentAttemptElem.textContent = currentAttempt;
        }

        // If the user has a UI element with id=reconnectProgressPercentage, update it
        const reconnectProgressPercentageElem = document.getElementById("reconnectProgressPercentage");
        if (reconnectProgressPercentageElem) {
            const progressPercentage = Math.round((currentAttempt / this.maxRetries) * 100);
            reconnectProgressPercentageElem.textContent = progressPercentage;

            const reconnectProgressBarElem = document.getElementById("reconnectProgressBar");
            if (reconnectProgressBarElem) {
                reconnectProgressBarElem.style.width = `${progressPercentage}%`;
                reconnectProgressBarElem.setAttribute('aria-valuenow', currentAttempt.toString());
            }
        }
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
