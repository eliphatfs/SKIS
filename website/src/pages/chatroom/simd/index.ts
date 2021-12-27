import page from 'page';
import body from './room.html?raw';
import $ from 'jquery';
import MarkdownIt from 'markdown-it';
import MarkdownItMath from 'markdown-it-texmath';
import highlighter from 'highlight.js';
import world from '../../../common';

interface Message {
    u: string
    msg: string
}


page('/chatroom/simd/:pid', (ctx) => {
    document.body.innerHTML = body;

    let dname = prompt("Enter your display name", localStorage.getItem("skis_chat_disp_name") || ("U" + Math.random()))
                || ("U" + Math.random());
    localStorage.setItem(
        "skis_chat_disp_name",
        dname
    );

    const pid = ctx.params.pid;
    const mdRenderer = new MarkdownIt({
        highlight: function (str, lang) {
            if (lang && highlighter.getLanguage(lang)) {
                try {
                    return highlighter.highlight(str, { language: lang, ignoreIllegals: true }).value;
                } catch (__) { }
            }

            return '';  // use external default escaping
        }
    }).use(MarkdownItMath);

    function message_receive(obj: Message) {
        let rendered = mdRenderer.render(obj.msg);
        let user = mdRenderer.render(obj.u);
        let appendee = `<li class="border-gray-200 border-b-2 break-words text-gray-600">
            <div>${rendered}</div>
            <div class="text-xs font-mono py-1 text-gray-300">${user}</div>
        </li>`;
        $("#chat-content-bearer")[0].innerHTML += appendee;
    }

    let ws = new WebSocket(new URL("/webpipe/" + pid + "/ws", world.host.replace("http", "ws")).toString());
    
    function message_send(msg: Message) {
        message_receive(msg);
        let ser = JSON.stringify(msg);
        ws.send(new Blob(["skis-PREAMBLE-0x5715d:" + ser.length + "LL" + ser]));
    }
    
    ws.onclose = () => {
        alert("You have disconnected. You can refresh to rejoin if the room still exists.");
    };
    ws.onopen = () => {
        let msg = {"u": "(Service)", "msg": `${dname} joined.`};
        message_send(msg);
    }

    let recv_buffer = "";
    let recv_queue: Promise<string>[] = [];
    ws.onmessage = async (msg) => {
        recv_queue.push(msg.data.text());
    }

    async function handleQueue() {
        while (recv_queue.length > 0) {
            recv_buffer += await recv_queue.shift();
        }
        let pream1, pream2;
        if ((pream1 = recv_buffer.indexOf("skis-PREAMBLE-0x5715d:")) != -1) {
            pream2 = recv_buffer.indexOf("LL", pream1);
            let len = parseInt(recv_buffer.substring(pream1 + "skis-PREAMBLE-0x5715d:".length, pream2));
            if (recv_buffer.length >= pream2 + "LL".length + len) {
                message_receive(JSON.parse(recv_buffer.substr(pream2 + "LL".length, len)));
                recv_buffer = recv_buffer.substr(pream2 + "LL".length + len);
                return setTimeout(handleQueue, 1);
            }
        }
        else {
            recv_buffer = "";
        }
        return setTimeout(handleQueue, 100);
    }

    handleQueue();

    $("#submit-btn").on("click", () => {
        let msg = {"u": dname, "msg": $("#editor-bearer").val() as string};
        if (!msg.msg) return;
        $("#editor-bearer").val("");
        message_send(msg);
        return false;
    });
});
