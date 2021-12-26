import page from 'page';
import body from './lobby.html?raw';
import $ from 'jquery';

interface Room {
    pid: string,
    numParticipants: number,
    numMessages: number,
    name: string
}

page('/chatroom/lobby', () => {
    document.body.innerHTML = body;
    const roomListDiv = $("#chat-room-list");

    $.getJSON(
        "/webpipe/query",
        (data: Room[]) => {
            let views: HTMLLIElement[] = [];
            for (let room of data) {
                let view = document.createElement("li");
                view.classList.add("p-3");
                view.classList.add("hover:bg-gray-100");
                view.setAttribute("x-pid", room.pid);
                view.innerHTML = `${room.name} <span class="text-xs text-gray-400">${room.numParticipants} online, ${room.numMessages} messages</span>`;
                $(view).hide();
                views.push(view);
            }
            roomListDiv.prepend(...views);
            $("#loading-container").hide(
                "fast",
                () => $(views).show("fast")
            );
        }
    );
});
