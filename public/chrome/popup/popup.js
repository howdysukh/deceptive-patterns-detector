
import * as constants from "../scripts/constants.js";


import { LitElement, html, css } from '../scripts/lit/lit-core.min.js';


import { onOffSwitchStyles, sharedStyles, actionButtonStyles, patternsListStyles, patternLinkStyles } from "./styles.js";


const brw = chrome;


const activationState = Object.freeze({
    On: 1,
    Off: 0,
    PermanentlyOff: -1,
});


brw.runtime.onMessage.addListener(
    function (message, sender, sendResponse) {
       
        document.querySelector("extension-popup").handleMessage(message, sender, sendResponse);
    }
);


async function getCurrentTab() {
    return (await brw.tabs.query({ active: true, currentWindow: true }))[0];
}


export class ExtensionPopup extends LitElement {
   
    static properties = {
        
        activation: { type: Number },
        
        initActivation: { type: Number },
        
        results: { type: Object }
    };

    constructor() {
        super();
       
        if (!constants.patternConfigIsValid) {
           
            this.activation = activationState.PermanentlyOff;
        } else {
        
            this.activation = activationState.Off;
        }
        this.initActivation = this.activation;
        
        this.results = {};
    }

    
    async handleMessage(message, sender, sendResponse) {
       
        if ("countVisible" in message) {
          
            if (sender.tab.active && (await getCurrentTab()).windowId === sender.tab.windowId) {
               
                this.results = message;
            }
        }
    }

   
    async firstUpdated() {
        
        if (this.activation === activationState.PermanentlyOff) {
           
            return;
        }
       
        let currentTab = await getCurrentTab();
       
        if (currentTab.url.toLowerCase().startsWith("http://") || currentTab.url.toLowerCase().startsWith("https://")) {
            
            let currentTabActivation = await brw.runtime.sendMessage({ "action": "getActivationState", "tabId": currentTab.id });
            
            if (currentTabActivation.isEnabled) {
                
                this.activation = activationState.On;

                
                while (true) {
                    try {
                      
                        this.results = await brw.tabs.sendMessage(currentTab.id, { action: "getPatternCount" });
                       
                        break;
                    } catch (error) {
                        
                        await new Promise(resolve => { setTimeout(resolve, 250) });
                    }
                }
            }
        } else {
            
            this.activation = activationState.PermanentlyOff;
        }
        
        this.initActivation = this.activation;
    }

   
    render() {
        return html`
            <popup-header></popup-header>
            <on-off-switch .activation=${this.activation} .app=${this}></on-off-switch>
            <refresh-button .hide=${this.activation === this.initActivation} .app=${this}></refresh-button>
            <redo-button .activation=${this.initActivation}></redo-button>
            <found-patterns-list .activation=${this.initActivation} .results=${this.results}></found-patterns-list>
            <show-pattern-button .activation=${this.initActivation} .results=${this.results}></show-pattern-button>
            <supported-patterns-list></supported-patterns-list>
            <popup-footer></popup-footer>
        `;
    }
}

customElements.define("extension-popup", ExtensionPopup);

export class PopupHeader extends LitElement {
    
    static styles = [
        sharedStyles,
        css`
            h3 {
                color: red;
            }
        `
    ];

   
    render() {
     }
}

customElements.define("popup-header", PopupHeader);


export class OnOffSwitch extends LitElement {
    
    static properties = {
        
        activation: { type: Number },
       
        app: { type: Object }
    };

   
    static styles = [
        sharedStyles,
        onOffSwitchStyles
    ];

   
    async changeActivation(event) {
        if (this.activation !== activationState.PermanentlyOff) {
            if (this.activation === activationState.Off) {
                this.activation = activationState.On;
            } else {
                this.activation = activationState.Off;
            }
            this.app.activation = this.activation;
        }
    }

    
    
}

customElements.define("on-off-switch", OnOffSwitch);


export class RefreshButton extends LitElement {
    
    static properties = {
        
        hide: { type: Boolean },
       
        app: { type: Object }
    };

   
    static styles = [
        sharedStyles,
        actionButtonStyles
    ];

   
    async refreshTab() {
        
        await brw.runtime.sendMessage({ "enableExtension": this.app.activation === activationState.On, "tabId": (await getCurrentTab()).id });
       
        await brw.tabs.reload();
        
        this.app.initActivation = this.app.activation;
    }

    
    render() {
        
        if (this.hide) {
         
        }
       
    }
}

customElements.define("refresh-button", RefreshButton);


export class RedoButton extends LitElement {
    
    static properties = {
       
        activation: { type: Number }
    };

    
    static styles = [
        sharedStyles,
        actionButtonStyles
    ];

   
    async redoPatternCheck(event) {
        await brw.tabs.sendMessage((await getCurrentTab()).id, { action: "redoPatternHighlighting" });
    }

   
    render() {
       
        if (this.activation !== activationState.On) {
            
        }
        
    }
}

customElements.define("redo-button", RedoButton);


export class FoundPatternsList extends LitElement {
    
    static properties = {
       
        activation: { type: Number },
       
        results: { type: Object }
    };

    
    static styles = [
        sharedStyles,
        patternsListStyles,
        patternLinkStyles
    ];

    
    render() {
       
        if (this.activation !== activationState.On) {
            
        }
        
    }
}

customElements.define("found-patterns-list", FoundPatternsList);


export class ShowPatternButtons extends LitElement {
    
    static properties = {
        
        activation: { type: Number },
       
        results: { type: Object },
        
        _currentPatternId: { type: Number, state: true },
        
        _visiblePatterns: { type: Array, state: true }
    };

    
    static styles = [
        sharedStyles,
        patternLinkStyles,
        css`
            .button {
                font-size: large;
                cursor: pointer;
                user-select: none;
            }

            span {
                display: inline-block;
                text-align: center;
            }

            span:not(.button) {
                width: 110px;
                margin: 0 15px;
            }
        `
    ];

   
    extractVisiblePatterns() {
    
        this._visiblePatterns = [];
       
        if (this.results.patterns) {
            
            for (const pattern of this.results.patterns) {
               
                if (pattern.elementsVisible.length > 0) {
                    
                    for (const elem of pattern.elementsVisible) {
                        
                        this._visiblePatterns.push({ "phid": elem, "patternName": pattern.name });
                    }
                }
            }
        }
    }

    getIndexOfPatternId(phid) {
        
        return this._visiblePatterns.map(pattern => pattern.phid).indexOf(phid);
    }

   
    async showPattern(step) {
        
        let idx;
            if (!this._currentPatternId) {
            if (step > 0) {
                
                idx = 0;
            } else {
                
                idx = this._visiblePatterns.length - 1;
            }
        } else {
            
            idx = this.getIndexOfPatternId(this._currentPatternId);
            if (idx === -1) {
               
                idx = 0;
            } else {
                
                idx += step;
            }
        }
        if (idx >= this._visiblePatterns.length) {
            
            idx = 0;
        } else if (idx < 0) {
            
            idx = this._visiblePatterns.length - 1;
        }
        
        this._currentPatternId = this._visiblePatterns[idx].phid;
       
        await brw.tabs.sendMessage((await getCurrentTab()).id, { "showElement": this._currentPatternId });
    }

    
    async showNextPattern(event) {
        await this.showPattern(1);
    }

    
    async showPreviousPattern(event) {
        await this.showPattern(-1);
    }

    
    getCurrentPatternText() {
        
        if (this._currentPatternId) {
           
            let idx = this.getIndexOfPatternId(this._currentPatternId);
            
            if (idx !== -1) {
                
                let currentPatternInfo = constants.patternConfig.patterns.find(p => p.name === this._visiblePatterns[idx].patternName);
                
               
            }
        }
        return html``;
    }

    
    getCurrentPatternNumber() {
        
        if (this._currentPatternId) {
            
            let idx = this.getIndexOfPatternId(this._currentPatternId);
            
            if (idx !== -1) {
                
                return `${idx + 1}`;
            }
        }
        return "-";
    }

   
    willUpdate(changedProperties) {
        
        if (changedProperties.has("results")) {
            this.extractVisiblePatterns();
        }
    }

   
    render() {
       
        if (this.activation !== activationState.On || this.results.countVisible === 0) {
            return html``;
        }

        return html`
        <div>
            <h2>${brw.i18n.getMessage("headingShowPattern")}</h2>
            <span class="button" @click=${this.showPreviousPattern}></span>
            <span>${brw.i18n.getMessage("showPatternState", [this.getCurrentPatternNumber(), this.results.countVisible.toString()])}</span>
            <span class="button" @click=${this.showNextPattern}></span>
            ${this.getCurrentPatternText()}
        </div>
      `;
    }
}

  
  fetch(chrome.runtime.getURL('data.tsv'))
    .then(response => response.text())
    .then(data => {
     
      let words = d3.tsvParseRows(data).flat();
  
      
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: (words) => {
            chrome.runtime.sendMessage({ words: words });
          },
          args: [words]
        });
      });
  
    
      const patternCount = countPatterns(words);
      document.getElementById('darkPatternsCount').textContent = patternCount;
    });
  
 
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.count !== undefined) {
    
      document.getElementById('darkPatternsCount').textContent = message.count;
    }
  });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.count !== undefined) {
        
        document.getElementById('darkPatternsCount').textContent = message.count;
    }
});

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('myButton').addEventListener('click', openTab_btn1);
});

function openTab_btn1() {
    chrome.tabs.create({ url: 'https://dapde.de/en/publikationen-co-en/dark-pattern-melden_de-en/' });
}



document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('myButton2').addEventListener('click', openTab_btn2);
});

function openTab_btn2() {
    chrome.tabs.create({ url: 'https://airtable.com/appDOQB7KICETdvfn/shrJ23ajrtXuKQyOr?hide_Category=true' });
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('alert').addEventListener('click', showAlert);
});

function showAlert(event) {
    event.preventDefault(); 
    alert('Extension is turned onn by default to prevent being distracted from Dark Patterns; Still if you want to Turn off -  you can Unpin / Unhide / Disengage / Disable from your browser.');
}


const ecommerceSites = ['www.amazon.com', 'mailchimp.com' ,'www.flipkart.com', 'www.amazon.in','www.myntra.com' , 'www.shopsy.in' , 'www.louisvuitton.com'];


chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
    let url = tabs[0].url;
    let hostname = new URL(url).hostname;

    
    
    if (ecommerceSites.some(site => hostname.endsWith(site))) {
        
        document.getElementById('darkPatternsCount').textContent = count ;
        console.log(count) 
        document.getElementById('darkPatternsCount2S').textContent = 'I highlighted all the dark patterns on this site';
    } else {
       
        document.getElementById('darkPatternsCount').textContent = 'Please open an e-commerce site';
    
      
        let pee = document.createElement('p');

        
        pee.innerHTML = '<center> is this an ecom site? help us to know more on more ecom sites by <a href="">Adding this site to our web analyser</a> </center>'; // Replace the href with the actual link

        document.getElementById('darkPatternsCount').appendChild(pee);
    }
});

