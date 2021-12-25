import page from 'page';
import body from './index.html?raw';
import $ from 'jquery';
import '../../../common';

page('/pastebin', () => {
    document.body.innerHTML = body;

    $("#btn-submit").on("click", () => {
        $("#btn-submit").attr("disabled", "disabled");
        $.post(
            "/pastebin", {
            "name": $("#input-name").val(),
            "contents": $("#input-contents").val()
        },
            (data: { key: string }) => {
                location.href = "/pastebin/" + encodeURIComponent(data.key);
            },
            "json"
        ).always(() => {
            $("#btn-submit").removeAttr("disabled");
        });
        return false;
    });

});
