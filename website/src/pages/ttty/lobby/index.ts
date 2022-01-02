import page from 'page';
import body from './lobby.html?raw';
import $ from 'jquery';
import '../../../common';

// TODO: this is highly similar to chat-room lobby.
// TODO: we need some better abstraction to organize the code...
const CAP_XTERM = 2;

interface Term {
    pid: string,
    name: string
}

page('/ttty/lobby', () => {
    document.body.innerHTML = body;
    const ttyListDiv = $("#tele-tty-list");

    $.getJSON(
        "/webpipe/query?requireCap=" + CAP_XTERM,
        (data: Term[]) => {
            let views: HTMLLIElement[] = [];
            for (let room of data) {
                let view = document.createElement("li");
                view.classList.add("p-3");
                view.classList.add("hover:bg-gray-100");
                view.setAttribute("x-pid", room.pid);
                view.innerHTML = `${room.name}`;
                $(view).hide();
                views.push(view);
                $(view).on("click", () => {
                    const xpid = view.getAttribute("x-pid");
                    if (xpid)
                        location.href = "/ttty/i/" + encodeURIComponent(xpid);
                });
            }
            ttyListDiv.prepend(...views);
            $("#loading-container").hide(
                "fast",
                () => $(views).show("fast")
            );
        }
    );
});
