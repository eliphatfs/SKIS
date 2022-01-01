import page from 'page';
import body from './lobby.html?raw';
import $ from 'jquery';
import '../../../common';

const CAP_CHATROOM = 1;

interface Room {
    pid: string,
    numParticipants: number,
    numMessages: number,
    name: string
}

page('/chatroom/lobby', () => {
    document.body.innerHTML = body;
    const roomListDiv = $("#chat-room-list");

    $("#create-btn").on("click", () => {
        $("#create-modal").fadeIn("fast");
        return false;
    });

    $("#btn-close-modal").on("click", () => {
        $("#create-modal").fadeOut("fast");
        return false;
    })

    $("#btn-submit").on("click", () => {
        $("#btn-submit").attr("disabled", "disabled");
        $.post(
            "/webpipe/allocate", {
            "name": $("#input-name").val(),
            "capabilities": CAP_CHATROOM
        },
            (data: { pid: string }) => {
                location.href = "/chatroom/simd/" + encodeURIComponent(data.pid);
            },
            "json"
        ).always(() => {
            $("#btn-submit").removeAttr("disabled");
        });
        return false;
    })

    $("#new-chat-form").on("submit", () => {
        $("#btn-submit").trigger("click");
        return false;
    });

    $.getJSON(
        "/webpipe/query?requireCap=" + CAP_CHATROOM,
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
                $(view).on("click", () => {
                    const xpid = view.getAttribute("x-pid");
                    if (xpid)
                        location.href = "/chatroom/simd/" + encodeURIComponent(xpid);
                });
            }
            roomListDiv.prepend(...views);
            $("#loading-container").hide(
                "fast",
                () => $(views).show("fast")
            );
        }
    );
});
