import page from 'page';
import body from './ttty.html?raw';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import $ from 'jquery';
import world from '../../common';
import 'xterm/css/xterm.css';
import CryptoJS from 'crypto-js';
import '../../shared/aes-eax.js';


const enum Command {
  // server side
  OUTPUT = '0',
  SET_WINDOW_TITLE = '1',
  SET_PREFERENCES = '2',

  // client side
  INPUT = '0',
  RESIZE_TERMINAL = '1',
  PAUSE = '2',
  RESUME = '3',
}


function dragElement(elmnt: HTMLElement, callback: (x: number, y: number) => void, yieldFrameDelta=true) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    elmnt.onpointerdown = dragMouseDown;
  
    function dragMouseDown(e: PointerEvent) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onpointerup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onpointermove = elementDrag;
    }
  
    function elementDrag(e: PointerEvent) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      if (yieldFrameDelta) {
        pos3 = e.clientX;
        pos4 = e.clientY;
      }
      callback(-pos1, -pos2);
    }
  
    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onpointerup = null;
      document.onpointermove = null;
    }
}


// Convert a hex string to a byte array
function hexToBytes(hex: string) {
  for (var bytes = [], c = 0; c < hex.length; c += 2)
      bytes.push(parseInt(hex.substr(c, 2), 16));
  return Uint8Array.from(bytes);
}

// Convert a byte array to a hex string
function bytesToHex(bytes: Uint8Array) {
  for (var hex = [], i = 0; i < bytes.length; i++) {
      var current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
      hex.push((current >>> 4).toString(16));
      hex.push((current & 0xF).toString(16));
  }
  return hex.join("");
}


function protocolSend(ws: WebSocket, msg: Uint8Array, pswd: CryptoJS.lib.WordArray) {
  let eax = (CryptoJS as any).EAX.create(pswd);
  let nonce = CryptoJS.lib.WordArray.random(16);
  let encrypted = eax.encrypt(CryptoJS.enc.Hex.parse(bytesToHex(msg)), nonce);
  ws.send(
    new Blob([
      hexToBytes(CryptoJS.enc.Hex.stringify(nonce)),
      hexToBytes(CryptoJS.enc.Hex.stringify(encrypted))
    ])
  );
}


function protocolReceive(term: Terminal, msg: Uint8Array, pswd: CryptoJS.lib.WordArray) {
  let eax = (CryptoJS as any).EAX.create(pswd);
  let nonce = CryptoJS.enc.Hex.parse(bytesToHex(msg.slice(0, 16)));
  let decrypted = eax.decrypt(CryptoJS.enc.Hex.parse(bytesToHex(msg.slice(16))), nonce);
  if (decrypted === false) {
    console.log("Corrupt data or unauthorized transmission. Discarding packet.");
    return;
  }
  term.write(hexToBytes(CryptoJS.enc.Hex.stringify(decrypted)));
}


page('/ttty/i/:pid', (ctx) => {
    document.body.innerHTML = body;
    const pid: string = ctx.params.pid;
    
    const term = new Terminal({
        fontSize: 15,
        lineHeight: 1,
        fontFamily: 'Cascadia Mono,Consolas,Liberation Mono,Menlo,monospace',
        theme: {
            background: '#0c0c0c',
            foreground: '#cccccc',
            black: '#0c0c0c',
            brightBlack: '#767676',
            red: '#C50F1F',
            brightRed: '#E74856',
            green: '#13A10E',
            brightGreen: '#16C60C',
            yellow: '#C19C00',
            brightYellow: '#F9F1A5',
            blue: '#0037DA',
            brightBlue: '#3B78FF',
            magenta: '#881798',
            brightMagenta: '#B4009E',
            cyan: '#3A96DD',
            brightCyan: '#61D6D6',
            white: '#CCCCCC',
            brightWhite: '#F2F2F2'
        }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open($('#term-container')[0]);
    fitAddon.fit();
    new ResizeObserver(() => setTimeout(() => fitAddon.fit(), 10)).observe($('#term-container')[0]);
    let sbar = $('#term-scroll');
    let shead = $('#term-scroll-head');
    let oldvY = -1, oldbY = -1;
    let ady = 0;
    setInterval(() => {
        let newvY = term.buffer.active.viewportY;
        let newbY = term.buffer.active.baseY;
        if (newvY === oldvY && newbY === oldbY)
            return;
        oldvY = newvY; oldbY = newbY;
        shead.css("top", newvY / newbY * (sbar.height()! - shead.height()!));
        ady = 0;
    }, 40);
    dragElement(shead[0], (dx, dy) => {
        ady += dy;
        let norpos = (shead.position()!.top + ady) / (sbar.height()! - shead.height()!);
        term.scrollToLine(Math.round(norpos * term.buffer.active.baseY));
    });
    term.write("Enter password: ");
    let pswdbuf = "";
    let pswdhash: CryptoJS.lib.WordArray;
    let disposableInitPassword = term.onData((x) => {
      if (x == '\r') {
        disposableInitPassword.dispose();
        pswdhash = CryptoJS.PBKDF2(pswdbuf, pid.substr(0, 16), {
          keySize: 6,
          iterations: 1000,
          hasher: CryptoJS.algo.SHA512
        });
        pswdbuf = "";
        let ws = new WebSocket(new URL("/webpipe/" + pid + "/ws", world.host.replace("http", "ws")).toString());
        term.onData((s) => {
          for (let i = 0; i < s.length; i += 15 * 1024) {
            protocolSend(ws, new TextEncoder().encode(Command.INPUT + s.substr(i, 15 * 1024)), pswdhash);
          }
        });
        term.onResize((size) => {
          const msg = JSON.stringify({ columns: size.cols, rows: size.rows });
          protocolSend(ws, new TextEncoder().encode(Command.RESIZE_TERMINAL + msg), pswdhash);
        });
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          protocolSend(ws, new TextEncoder().encode(
            JSON.stringify({
                AuthToken: '',
                columns: term.cols,
                rows: term.rows,
            })), pswdhash);
        };
        ws.onmessage = (x) => {
          protocolReceive(term, new Uint8Array(x.data as ArrayBuffer), pswdhash);
        };
        ws.onclose = () => {
          alert("You have disconnected. You can refresh to reconnect if the ttty is still online.");
        };
      }
      else {
        pswdbuf += x;
      }
    });
});
