import $ from 'jquery';
import '../common';

$(() => {

$("#btn-submit").on("click", () => {
    $("#btn-submit").attr("disabled", "disabled");
    $.post(
        "/pastebin", {
            "name": $("#input-name").val(),
            "contents": $("#input-contents").val()
        },
        (data: {key: string}) => {
            location.href = "./v.html?k=" + encodeURIComponent(data.key);
        },
        "json"
    ).always(() => {
        $("#btn-submit").removeAttr("disabled");
    });
    return false;
});

});

export {};
