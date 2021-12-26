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
        let appendee = `<li class="border-gray-200 border-b-2 text-gray-600">
            <div>${rendered}</div>
            <div class="text-xs font-mono py-1 text-gray-300">${user}</div>
        </li>`;
        $("#chat-content-bearer")[0].innerHTML += appendee;
    }

    let ws = new WebSocket(new URL("/webpipe/" + pid + "/ws", world.host.replace("http", "ws")).toString());
    ws.onclose = () => {
        alert("You have disconnected. You can refresh to rejoin if the room still exists.");
    };
    ws.onopen = () => {
        let msg = {"u": "(Service)", "msg": `${dname} joined.`};
        message_receive(msg);
        ws.send(new Blob([JSON.stringify(msg)]));
    }
    ws.onmessage = async (msg) => {
        message_receive(JSON.parse(await msg.data.text()));
    }

    $("#submit-btn").on("click", () => {
        let msg = {"u": dname, "msg": $("#editor-bearer").val() as string};
        $("#editor-bearer").val("");
        message_receive(msg);
        ws.send(new Blob([JSON.stringify(msg)]));
        return false;
    });
});
