$( document ).ready( function() {
    /* main cockpit elements */
    var required_elements = ["time",
                             "reason",
                             "package",
                             "container_image",
                             "container_id",
                             "count"];

    /* ordered detail elements */
    var detail_elements = ["exploitable",
                           "not-reportable",
                           "reason",
                           "backtrace",
                           "crash_function",
                           "cmdline",
                           "executable",
                           "package",
                           "component",
                           "pid",
                           "pwd",
                           "hostname",
                           "count",
                           "user", /* special element consists from username and (uid) */
                           "type/analyzer", /* special element */
                           "last_occurence"];
    /*
     * In case that you want to display some special element (for example element
     * which is composed of two elements) you have to add its name to the
     * 'detail_element' array, add the name to the 'special_elements' list and
     * define its required content in the function 'get_element_content'.
     *  */
    var special_elements = ["user",
                            "type/analyzer"];

    /* ignored elements */
    var black_list_elements = ["pkg_name",
                               "pkg_version",
                               "pkg_release",
                               "pkg_arch",
                               "pkg_epoch"];

    var service = cockpit.dbus('org.freedesktop.problems');
    var problems = service.proxy('org.freedesktop.problems', '/org/freedesktop/problems');

    /* load all problems */
    problems.wait(load_problems);

    function load_problems() {
        problems.GetAllProblems()
            .done(function(args, options) {
                args.forEach(function(problem_id) {
                    problems.GetProblemData(problem_id)
                        .done(function(problem_data, options) {
                            $("#problems tbody").append(problem_data_to_row(problem_data, problem_id));
                });
            });
        });
    }

    function problem_data_to_row(problem_data, problem_id) {
        var row = "";

        required_elements.forEach(function(elem) {
            row += "<td>" + format_problem_data(problem_data, elem) + "</td>";
        });

        row += get_action_btn();

        return "<tr id=\"" + escapeHtml(problem_id) + "\" class=\"problem\">" + row + "</tr><tr class=\"detail_list hidden\"><td colspan=\"7\"></td></tr>";
    }

    function format_problem_data(problem_data, elem) {
        if (!problem_data.hasOwnProperty(elem)) {
            return "";
        }

        var value = problem_data[elem][2];

        if (elem == "time") {
            value = new Date(parseInt(value) * 1000).toLocaleString();
        }

        return escapeHtml(value);
    }

    function get_action_btn() {
        var btn = "<td class=\"action_btn\">";
        btn += "<div class=\"btn-group\">";
        btn += "<button class=\"btn btn-default main-btn\" title=\"\">";
        btn += "Delete";

/* Prepared for adding another functionality
 *
        btn += "</button>";
        btn += "<button class=\"btn btn-default dropdown-toggle\" data-toggle=\"dropdown\">";
        btn += "<span class=\"caret\"></span>";
        btn += "</button>";

        btn += "<ul class=\"dropdown-menu\" role=\"menu\">";
        btn += get_btn_dropdown_li("Report");
        btn += get_btn_dropdown_li("Detail");
        btn += "</ul>";
*/

        btn += "</div>";
        btn += "</td>";

        return btn;
    }

    function get_btn_dropdown_li(label) {
        var li = "<li class=\"presentation\">";
        li += "<a role=\"menuitem\">";
        li += "<span>" + label + "</span>";
        li += "</a>";
        li += "</li>";

        return li;
    }

    /* problem info click handler */
    $( document ).on('click', '.problem', function() {
        problem_detail(this);
    });

    function problem_detail( problem ) {
        var detail_row = $(problem).next();

        /* detail is shown */
        if ($(problem).hasClass("selected_problem")) {

            $(problem).removeClass("selected_problem");
            $(detail_row).addClass("hidden");
        }
        /* detail is not displayed, but it is loaded */
        else if ($(detail_row).hasClass("loaded")) {
            $(problem).addClass("selected_problem");
            $(detail_row).removeClass("hidden");
        }
        /* detail is not displayed nor loaded */
        else {
            create_detail_table(problem);

            $(problem).addClass("selected_problem");
            $(detail_row)
                .removeClass("hidden")
                .addClass("loaded");
        }
    }

    function create_detail_table(row) {
        var problem_id = $(row).attr('id');

        problems.GetProblemData(problem_id)
            .done(function(problem_data, options) {

                var result = create_detail(problem_data, problem_id);

                $(row).next().children().append(result);
            });
    }

    function create_detail(problem_data, problem_id) {
        var text = "";
        /*  show detail_elements */
        for (i = 0; i < detail_elements.length; i++) {
            var elem = detail_elements[i];
            text += create_detail_element(problem_data, problem_id, elem);
        }

        /* get all keys from problem data (array of all element's names) */
        var problem_data_elems = Object.keys(problem_data);
        problem_data_elems.sort();

        /* display oneline elements from problem data (which are not on black list)*/
        for (var elem_index in problem_data_elems) {

            var elem_name = problem_data_elems[elem_index];
            var elem_data = problem_data[elem_name];
            if (elem_data[2].indexOf('\n') > -1 || (elem_data[0] & 1 /* binary */))
                continue;
            text += create_detail_element(problem_data, problem_id, elem_name);

            delete problem_data_elems[elem_index];
        }

        /* display DATA_DIRECTORY path */
        text += "<tr class=\"detail\"><td class=\"detail_label\">DATA_DIRECTORY</td><td class=\"detail_content\">" + problem_id + "</td></tr>";

        /* display binary elements from problem data (which are not on black list)*/
        for (var elem_index in problem_data_elems) {

            var elem_name = problem_data_elems[elem_index];
            var elem_data = problem_data[elem_name];
            if ((elem_data[0] & 1 /* binary */) == 0)
                continue;
            text += create_detail_element(problem_data, problem_id, elem_name);

            delete problem_data_elems[elem_index];
        }

        /* display multiline elements from problem data (which are not on black list)*/
        for (var elem_index in problem_data_elems) {

            var elem_name = problem_data_elems[elem_index];
            text += create_detail_element(problem_data, problem_id, elem_name);
        }

        /* add instruction how to report problem if problem is not reported and is reportable */
        if (!problem_data.hasOwnProperty("not-reportable")) {
            var reported = false;

            if (problem_data.hasOwnProperty("reported_to")) {
                var reported_to = problem_data["reported_to"][2];
                reported_to = reported_to.split("\n");

                for (var i = 0; i < reported_to.length; ++i) {
                    var line = reported_to[i];
                    if (line.substring(0, 8) != "uReport:" && line.substring(0, 12) != "ABRT Server:" && line != "") {
                        reported = true;
                        break;
                    }
                }
            }
            /* bug is not reported */
            if (reported == false) {
                text += "<tr class=\"how_to_report\"><td colspan=\"2\"><div class=\"inline_block\">Please run the following command on the machine where the crash occurred in order to report the problem:<br/><samp>$ abrt-cli report " + problem_id + "</samp></div></td></tr>";
            }
        }

        return text;
    }

    function create_detail_element(problem_data, problem_id, elem) {

        var text = "";
        /* skip this element if it is on black list */
        if (black_list_elements.indexOf(elem) > -1)
            return text;

        if (problem_data.hasOwnProperty(elem) || special_elements.indexOf(elem) > -1) {

            var elem_name = {"name": elem};
            var problem_content = get_element_content(problem_data, elem_name);
            elem = elem_name.name;
            if (problem_content != "") {

                var additional_classes = "";
                if (elem == "docker_inspect") {
                    additional_classes += "pre ";
                }

                if (elem == "dso_list") {
                    /* bold name of packages */
                    problem_content = problem_content.replace(/^(\S+\s+)(\S+)(.*)$/gm, "$1<b>$2</b>$3");
                }

                /* clickable url in reported_to */
                if (elem == "reported_to") {
                    /* AAA URL=aaa BBB=bbb -> AAA URL=<a href="aaa" ...>aaa</a> BBB=bbb */
                    problem_content = problem_content.replace(/URL=([^\s]+)(\s|$)/g, "URL=<a href=\"$1\" target=\"_blank\">$1</a>$2");
                }

                if (problem_content.indexOf('\n') != -1) {

                    problem_content = highlight_multiline_items(problem_content, elem);

                    if (elem == "limits") {
                        problem_content = create_table_from_problem_data(problem_content, " {2,}", 4);
                    }

                    if (elem == "maps") {
                        problem_content = create_table_from_problem_data(problem_content, " +", 6);
                    }

                    if (elem == "mountinfo") {
                        problem_content = create_table_from_problem_data(problem_content, " +", 11, true);
                    }

                    problem_content = problem_content.replace(/\n/g, "<br>");

                    text += "<tr class=\"detail detail_dropdown\"><td class=\"detail_label\">" + escapeHtml(elem);
                    text += "</td><td class=\"detail_content\"><span class=\"detail_dropdown_span fa fa-angle-right\"></span></td></tr>";
                    text += "<tr class=\"detail hidden\"><td class=\"detail_label\">";
                }
                else {
                    text += "<tr class=\"detail\"><td class=\"detail_label\">" + escapeHtml(elem);
                }
                text += "</td><td class=\"detail_content " + additional_classes + "\">" + problem_content + "</td></tr>";
            }
        }
        return text;
    }

    function create_table_from_problem_data(problem_content, regexp_str, column_count,  big_table = false) {

        var  max_width = get_max_column_width(column_count);

        var problem_content_lines = problem_content.split('\n');

        var regexp = new RegExp(regexp_str,"g");
        var table_content = "";
        for (var line in problem_content_lines) {

            table_content += "<tr>";
            var items = problem_content_lines[line].split(regexp);
            for (var item in items) {
                var item_text = items[item];

                /* if is length of the text more than 8 and it is a big table add title to the item */
                var title = "";
                if (item_text.length > 8) {
                    title = "title=\"" + item_text + "\"";
                }
                table_content += "<td style=\"max-width: " + max_width + "px\"" + title + " >";

                table_content += items[item];
                table_content += "</td>";
            }
            table_content += "</tr>";
        }


        return "<table class=\"detail_table\">" + table_content + "</table>";
    }

    /* the function count max_width of one column in detail table
    depending on the width of the table.
    The function calculates a width of one column and multiplies it by a value which
    depends on a width of table.
    All constants in the function I got experimentally */
    function get_max_column_width(column_count) {
        var min_from = 600;
        var max_from = 1800;

        var min_to = 0.7;
        var max_to = 2.2;

        var width = ($(".problem").first().width());
        if (width < min_from)
            width = min_from;

        if (width > max_from)
            width = max_from;

        var normalize = (width - min_from)/(max_from-min_from);
        normalize = min_to + normalize * (max_to - min_to);

        var width_one_column = ($(".problem").first().width()) / column_count;
        var max_width = Math.round(width_one_column * normalize);

        return max_width;
    }

    function highlight_multiline_items(problem_content, elem) {

        /* bold variable 'ABC=abc' -> '<b>ABC=</b>abc' */
        /* we want to highlight only multiline elements */
        if (problem_content.match(/^[^=\n]+=[^\n]*/) != null) {
            problem_content = problem_content.replace(/^([^=\s]+=)(.*)$/gm, "<b>$1</b>$2");
        }
        /* bold variable 'ABC: abc' -> '<b>ABC: </b>abc' */
        else if (problem_content.match(/^[^:\n]+:[^\n]*/) != null && elem != "dead.letter") {
            problem_content = problem_content.replace(/^([^:=;\d]+ ?:)(.*)$/gm, "<b>$1</b>$2");
            problem_content = problem_content.replace(/^(\[[^:=;]+\] ?:)(.*)$/gm, "<b>$1</b>$2");
        }

        /* bold titles of items in open_fds */
        if (elem == "open_fds") {
            problem_content = problem_content.replace(/^(\d+:.*\d+)$/gm, "<b>$1</b>");
        }

        return problem_content;

    }

    function get_element_content(problem_data, elem) {

        /* ordinary element */
        if(problem_data.hasOwnProperty(elem.name)) {
            return get_element_content_if_exist(problem_data, elem.name);
        }

        /* special element */
        var text = "";
        switch (elem.name) {
            case "user": /*  username (uid)*/
                var username = get_element_content_if_exist(problem_data, "username");
                var uid = get_element_content_if_exist(problem_data, "uid");
                if (username != "" && uid != "") {
                    text += username;
                    text += " (" + uid + ")";
                    break;
                }
                if (uid != "") {
                    elem.name = "uid";
                    text += uid;
                    break;
                }
                if (username != "") {
                    text += username;
                    break;
                }
                break;
            case "type/analyzer": /*  type/analyzer */
                var type = get_element_content_if_exist(problem_data, "type");
                var analyzer = get_element_content_if_exist(problem_data, "analyzer");
                if (type != "" && analyzer != "") {
                    text += type;
                    text += "/" + analyzer;
                    break;
                }
                if (analyzer == "") {
                    elem.name = "type";
                    text += type;
                    break;
                }
                break;
            default:
                break;
        }
        return text;
    }

    /* get content of element 'elem' if exist and remove it from the problem_data */
    function get_element_content_if_exist(problem_data, elem) {
        if(problem_data.hasOwnProperty(elem)) {
            var content = problem_data[elem][2];

            if (elem == "time" || elem == "last_occurrence") {
                content = new Date(parseInt(content) * 1000).toLocaleString();
            }

            /* binary file */
            if (problem_data[elem][0] & 1 /* 1 is flag for binary file */) {
               var size = humanSize(problem_data[elem][1]);
               content = "$DATA_DIRECTORY/" + elem + " (binary file, " + size + ")";
            }

            /* remove the shown element */
            delete problem_data[elem];
            return escapeHtml(content);
        }
        return "";
    }

    function humanSize(bytes) {
        var thresh = 1024;
        var units = ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];

        if(bytes < thresh) return bytes + ' B';
        var u = -1;
        do {
            bytes /= thresh;
            ++u;
        } while(bytes >= thresh);
        return bytes.toFixed(1)+' '+units[u];
    };

    /* dropdown multiline detail handler */
    $( document ).on('click', '.detail_dropdown', function( event ) {
        event.stopPropagation();
        problem_detail_dropdown_item(this);
    });

    function problem_detail_dropdown_item( item ) {

        var desc = $(item).next();
        var dropdown_title = $(item).find("span");

        /* show detail */
        if ($(desc).hasClass("hidden")) {
            $(desc).removeClass("hidden");
            $(dropdown_title).addClass("fa-angle-down");
            $(dropdown_title).removeClass("fa-angle-right");
        }
        /* hide detail */
        else {
            $(desc).addClass("hidden");
            $(dropdown_title).addClass("fa-angle-right");
            $(dropdown_title).removeClass("fa-angle-down");
        }
    }

    /* delete btn handler */
    $( document ).on('click', '.main-btn', function( event ) {
        event.stopPropagation();
        var problem = $(this).closest('tr');
        delete_problem( problem );
    });

    /* delete all btn handler */
    $( document ).on('click', '.delete-all-btn', function( event ) {
        $(".problem").each(function() {
            delete_problem(this);
        });
    });

    function delete_problem( problem ) {
        var problem_id = $(problem).attr('id');
        var del = problems.DeleteProblem([problem_id]);
        del.done(function() {
            //console.log(problem_id + " deleted.");
            $(problem).addClass("hidden");
            /* hide also the problem description */
            $(problem).next().addClass("hidden");
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\//g, "&#x2F;")
    }
});
