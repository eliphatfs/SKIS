import page from 'page';
import body from './ttty.html?raw';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import $ from 'jquery';
import 'xterm/css/xterm.css';


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


page('/ttty/i/:pid', (ctx) => {
    document.body.innerHTML = body;
    const pid = ctx.params.pid;
    
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
});
