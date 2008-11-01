/**
 * share-on-delicious - an Ubiquity command for sharing bookmarks on
 * delicious.com
 *
 * l.m.orchard@pobox.com
 * http://decafbad.com/
 * Share and Enjoy!
 *
 * TODO: repackage to separate share command from status bar and future commands.
 * TODO: work out how to use suggested tags in the UI
 * TODO: implement modifier to support private posting
 * TODO: handle error codes from delicious, not just HTTP itself
 * TODO: templatize the rest of the message strings
 * TODO: i18n on templates?
 */
var share_on_delicious_cmd = (function() {

    return {

        name:        
            'share-on-delicious',
        icon:
            'http://delicious.com/favicon.ico',
        description: 
            'Share the current page as a bookmark on delicious.com',
        help: <span>
            Select text on the page to use as notes, or enter your own  
            text after the command word.  You can also assign tags to the 
            bookmark with the <code>tagged</code> modifier, and alter the bookmark  
            default page title with the <code>entitled</code> modifier.  Note that  
            you must also already be logged in at delicious.com to use 
            this command.
        </span>.toXMLString(),

        homepage:   
            'http://decafbad.com',
        author: { 
            name: 'Leslie Michael Orchard', 
            email: 'l.m.orchard@pobox.com' 
        },
        license:
            'MPL/GPL/LGPL',

        /**
         * Initialize the command package.  Creates the command after doing
         * a last few bits of wiring.  Called at the very end of the file.
         */
        init: function() {
            this.takes = { 
                quote: noun_arb_text 
            };
            this.modifiers = { 
                quoted:   noun_arb_text,
                tagged:   noun_arb_text,
                // tagged:   this.noun_type_tags, 
                entitled: noun_arb_text
            };
            CmdUtils.CreateCommand(this);
            return this;
        },

        /**
         * Command configuration settings.
         */
        config: {
            // Base URL for the delicious v1 API
            api_base:      'https://api.del.icio.us',

            // Domain and name of the delicious login session cookie.
            cookie_domain: '.delicious.com',
            cookie_name:   '_user',

            // ID for the XUL element displaying bookmark info
            status_bar_id: 'ubiq-delicious-panel'
        },

        // XML NS for XUL elements, used for the status bar panel.
        XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

        // Cache of URL info loaded up from Delicious
        urlinfo: {},

        /**
         * React to browser startup.
         */
        onStartup: function() {
            var _this = this;

            Application.activeWindow.events.addListener(
                'TabSelect', function() { _this.onTabSwitch() }
            );

            /*
            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
            wm.addListener({
                onCloseWindow: function(win) {
                },
                onOpenWindow: function(win) {
                    // TODO: Figure out how to get a TabSelect event attached to this
                    displayMessage("NEW WINDOW " + Application.activeWindow.activeTab.uri.spec);
                },
                onWindowTitleChange: function(win, title) {
                }
            });
            */
        },

        /**
         * On tab switch, attempt to update the status bar with cached URL
         * info for that tab.
         */
        onTabSwitch: function() {
            var url = Application.activeWindow.activeTab.uri.spec;         
            this.fetchPageInfo(url);
        },

        /**
         * React to page load.
         */
        onPageLoad: function(doc) {
            var uri = Utils.url(doc.documentURI);
            if (uri.scheme != "http") return;
            this.fetchPageInfo(uri.spec, true);
        },

        /**
         * Present a preview of the bookmark under construction during the course
         * of composing the command.
         */
        preview: function(pblock, input_obj, mods) {
            var bm          = this.extractBookmarkData(input_obj, mods);
            var user_cookie = this.getUserCookie();
            var user_name   = (user_cookie) ? user_cookie.split(' ')[0] : '';

            var chars_left = (bm.extended) ? 1000 - bm.extended.length : 1000;
            var ns = { 
                user_name: user_name, 
                bm: bm,
                chars_left: chars_left,
                chars_over: (chars_left < 0)
            };

            var tmpl;
            if (!user_name) {
                tmpl = this.templates.preview_user_error;
            } else if (!bm.description) {
                tmpl = this.templates.preview_title_error;
            } else {
                tmpl = this.templates.preview_full;
            }

            pblock.innerHTML = this.renderE4XTemplate(tmpl, ns);
        },
        
        /**
         * Attempt to use the delicious v1 API to post a bookmark using the 
         * command input
         */
        execute: function(input_obj, mods) {
            var bm          = this.extractBookmarkData(input_obj, mods);
            var user_cookie = this.getUserCookie();
            var user_name   = (user_cookie) ? user_cookie.split(' ')[0] : '';

            if (!user_name) {
                displayMessage(
                    'No active user found - log in at delicious.com ' +
                    'to use this command.'
                );
                return false;
            }

            if (!bm.description) {
                displayMessage(
                    "A title is required for bookmarks at delicious.com"
                );
                return false;
            }

            if (bm.extended && bm.extended.length > 1000) {
                displayMessage(
                    "The bookmark notes are " + 
                        Math.abs(1000-bm.extended.length) + " characters " + 
                        "too long."
                );
                return false;
            }

            this.v1api(
                '/v1/posts/add', bm, 
                function() {
                    displayMessage('Bookmark "' + bm.description + '" ' + 
                        'shared at delicious.com/' + user_name);
                },
                function() {
                    // TODO: more informative reporting on errors
                    displayMessage('ERROR: Bookmark "' + bm.description + '" ' + 
                        ' NOT shared on delicious.com/' + user_name);
                }
            );

        },

        /**
         * A noun type for suggesting Delicious tags
         *
         * TODO: fetch and cache tags from user's account
         * TODO: use the tag suggestion call on the API
         */
        noun_type_tags: {

            _name: 'tags',

            getTags: function() {
                return [ 'osx', 'apple', 'software', 'testing' ];
            },

            suggest: function(text, html) {
                var sugg_tags = this.getTags();
                var curr_tags = (''+text).split(' ');
                
                var suggestions = [];

                if (curr_tags.length) {
                    var last_tag  = curr_tags.pop();

                    for (var i=0,tag; tag=sugg_tags[i]; i++) {
                        if ( tag.indexOf( last_tag ) > -1 ) {
                            var sugg_tags = curr_tags.join(' ') + ' ' + tag;
                            suggestions.push( CmdUtils.makeSugg( sugg_tags, sugg_tags, sugg_tags ) );
                        }
                    }
                }

                return suggestions;
            }

        },

        /**
         * Given a URL, update the cached URL info if needed and update the 
         * status bar display if the URL is for hte active tab.
         */
        fetchPageInfo: function(url, refresh) {
            var Ci = Components.interfaces;
            var Cc = Components.classes;

            var url_hash = this.md5(url);

            var _this = this;

            var now  = (new Date()).getTime();
            var info = this.urlinfo[url_hash];

            if (!refresh && info && ( (info.time - now) < (1000 * 60 * 5) ) ) {

                // Use the cached URL info, if anything fresh is available.
                return this.updatePageInfo(info);
            
            } else {

                var feed_url = 'http://feeds.delicious.com' + 
                    '/v2/json/urlinfo/blogbadge?hash=';
                
                if (url == Application.activeWindow.activeTab.uri.spec)
                    this.setStatusBarText('loading...');

                jQuery.ajax({
                    type: 'GET', url:  feed_url + this.md5(url),

                    success: function(data, status) {
                        var JSON = Cc["@mozilla.org/dom/json;1"]
                            .createInstance(Ci.nsIJSON);
                        var data = JSON.decode(data);

                        var urlinfo = _this.urlinfo[url_hash] = 
                            { data: data, time: now };

                        if (url == Application.activeWindow.activeTab.uri.spec)
                            _this.updatePageInfo(urlinfo);
                    },

                    error: function(req, status, err) {
                        this.setStatusBarText('error!');
                    }

                });

            }
        },

        /**
         * Given a URL info record, update the status bar.
         */
        updatePageInfo: function(info) {
            if (!info.data.length) {
                this.setStatusBarText('0 bookmarks', 'be the first!');
            } else {
                var tags  = info.data[0].top_tags;
                var count = info.data[0].total_posts;
                this.setStatusBarText(
                    count + ' bookmarks',
                    "Bookmarked by " + count + " people; tagged " + [
                        tag + ' (' + tags[tag] + ')' for (tag in tags)
                    ].join(", ") + '.'
                );
            }
        },

        /**
         * Handle a click on the status bar panel.
         */
        onStatusBarClick: function() {
            var url = Application.activeWindow.activeTab.uri.spec;
            var url_hash = this.md5(url);
            Utils.openUrlInBrowser('http://delicious.com/url/' + url_hash);
        },

        /**
         * Set the status bar text to the given string.
         */
        setStatusBarText: function(str, tip) {
            var panel_id = this.config.status_bar_id;

            var doc = window.document;
            var sb = doc.getElementById('status-bar');
            var sp = doc.getElementById(panel_id);

            // If the status bar panel isn't found, create and inject it.
            if (!sp) {

                sp = doc.createElementNS(this.XUL_NS, "statusbarpanel");
                sp.setAttribute('id', panel_id);
                sb.appendChild(sp);

                sp.setAttribute('class', 'statusbarpanel-iconic-text');
                sp.setAttribute('src', this.DEL_ICON_URL);

                var _this = this;
                sp.addEventListener(
                    'click', function() { _this.onStatusBarClick() }, false
                );
            }

            sp.setAttribute('tooltiptext', tip);
            sp.setAttribute('label', str);
        },

        /**
         * Fire off a Delicious V1 API request.
         */
        v1api: function(path, data, success, error) {

            // Build a User-Agent string derived from the browser's, if none
            // previously defined.
            if (!this.user_agent) {
                var mediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                    getService(Components.interfaces.nsIWindowMediator);
                var win = mediator.getMostRecentWindow(null);
                this.user_agent = win.navigator.userAgent + ";Ubiquity-share-on-delicious";
            }

            // Inject the user auth cookie into the API parameters.
            data['_user'] = this.getUserCookie();
            
            jQuery.ajax({
                type:     'POST', 
                url:      this.config.api_base + path,
                data:     this.buildQueryString(data),
                username: 'cookie',
                password: 'cookie',
                beforeSend: function(req) {
                    req.setRequestHeader("User-Agent", this.user_agent);
                },
                success: success || function() {
                    displayMessage('Delicious API call ' + path + ' succeeded.');
                },
                error: error || function() {
                    displayMessage('ERROR: Delicious API call ' + path + ' failed!');
                }
            });

        },

        /**
         * Given input data and modifiers, attempt to assemble data necessary to
         * post a bookmark.
         */
        extractBookmarkData: function(input_obj, mods) {
            return {
                url:
                    Application.activeWindow.activeTab.uri.spec,
                description:
                    mods.entitled.text || context.focusedWindow.document.title,
                extended: 
                    input_obj.text + ( mods.quoted.text ? ' "' + mods.quoted.text + '"' : '' ),
                tags: 
                    mods.tagged.text
            };
        },

        /**
         * Dig up the Delicious login session cookie.
         */
        getUserCookie: function() {
            var cookie_mgr = Components.classes["@mozilla.org/cookiemanager;1"]
                .getService(Components.interfaces.nsICookieManager);
            var iter = cookie_mgr.enumerator;
            while (iter.hasMoreElements()) {
                var cookie = iter.getNext();
                if( cookie instanceof Components.interfaces.nsICookie && 
                    cookie.host.indexOf(this.config.cookie_domain) != -1 && 
                    cookie.name == this.config.cookie_name) {
                    return decodeURIComponent(cookie.value);
                }
            }
        },

        /**
         * Given an object, build a URL query string
         */
        buildQueryString: function(data) {
            var qs = [];
            for (k in data) if (data[k]) 
                qs.push( encodeURIComponent(k) + '=' + 
                    encodeURIComponent(data[k]) );
            return qs.join('&');
        },

        /**
         * Calculate an MD5 hash for a given string
         */
        md5: function(str) {
            var Ci = Components.interfaces;
            var Cc = Components.classes;

            var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                .createInstance(Ci.nsIScriptableUnicodeConverter);
            converter.charset = 'UTF-8';
            var result = {};
            var data = converter.convertToByteArray(str, result);

            var ch = Cc["@mozilla.org/security/hash;1"]
                .createInstance(Ci.nsICryptoHash);
            ch.initWithString('md5');
            ch.update(data, data.length);
                
            var hash = ch.finish(false);

            return [
                ('0' + (hash.charCodeAt(i).toString(16)) ).slice(-2) 
                for (i in hash)
            ].join("");
        },

        /**
         * Given an XML doc, render as a template.  
         * 
         * Since both JST and E4X use { and } functionally, [[ and ]] are 
         * used as a convention for JST's syntax.
         */
        renderE4XTemplate: function(xml, ns) {
            var tmpl = xml.toXMLString().replace(/\[\[/g,'{').replace(/\]\]/g, '}');
            return CmdUtils.renderTemplate(tmpl, ns);
        },

        /**
         * Templates for producing previews and other content.
         */
        templates: {

            // Preview displayed when no user login found.
            preview_user_error:
                <p style="color: #d44">
                    No active user found - log in at 
                    <img src="http://delicious.com/favicon.ico" /> 
                    <b><a style="color: #3774D0" href="http://delicious.com">delicious.com</a></b>  
                    to use this command.
                </p>,

            // Preview displayed when title missing.
            preview_title_error:
                <p style="color: #d44">
                    A title is required for bookmarks on  
                    <img src="http://delicious.com/favicon.ico" /> 
                    <b><a style="color: #3774D0" href="http://delicious.com">delicious.com</a></b>  
                </p>,

            // Preview showing full bookmark data.
            preview_full:
                <div class="preview">
                    <style type="text/css"><![CDATA[
                        .preview a { color: #3774D0 }
                        .del-bookmark { font: 12px arial; color: #ddd; background: #eee; line-height: 1.25em; padding: 1em }
                        .del-bookmark a.title { color: #1259C7 }
                        .del-bookmark .full-url { color: #396C9B; font-size: 12px; display: block; padding: 0.25em 0 }
                        .del-bookmark .notes { color: #4D4D4D }
                        .del-bookmark .counter { color: #999; text-align: right; padding-top: 0.5em; font-size: 85% }
                        .del-bookmark .counter .over { color: #c44; font-weight: bold }
                        .del-bookmark .tags { color: #787878; padding-top: 0.25em; text-align: right }
                    ]]></style>
                    <p>Share a bookmark at <img src="http://delicious.com/favicon.ico" /> 
                        <b><a href="http://delicious.com/$[[user_name]]">delicious.com/$[[user_name]]</a></b>
                        <div class="del-bookmark">
                            <a class="title" href="$[[bm.url]]">$[[bm.description]]</a>
                            <a class="full-url" href="$[[bm.url]]">$[[bm.url]]</a>
                            [[if bm.extended]]
                                <div class="notes">$[[bm.extended]]</div>
                                <div class="counter"><span class="$[[ (chars_over) ? 'over' : 'under' ]]">
                                    $[[chars_left]] characters $[[ (chars_over) ? 'over' : 'remaining' ]]
                                </span></div>
                            [[/if]]
                            [[if bm.tags]]<div class="tags"><span>tags:</span> $[[bm.tags]]</div>[[/if]]
                        </div>
                    </p>
                </div>

        },

        /**
         * Original flat 4-color delicious logo.
         */
        DEL_ICON_URL_OLD: <data><![CDATA[
            data:image/gif;base64,R0lGODlhEAAQAKIAAAAAAP///zJ00NPS0v// 
            /wAAAAAAAAAAACH5BAEAAAQALAAAAAAQABAAAAMsGLoq/o4xCOWizzYsdO  
            CdBnqjyAFoig5sy6qq68Kp3NKrPeCAvuM+XhCoSwAAOw==
        ]]></data>.toString().replace(/\s/g,''),

        /**
         * Sexier gradient delicious logo.
         */
        DEL_ICON_URL: <data><![CDATA[
            data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAY
            AAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3No
            b3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi
            4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6
            OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8T
            G4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH
            /w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjA
            FAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwAB
            RmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AIS
            ZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJh
            mkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiY
            uP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoO
            naV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7
            iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41ES
            cY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQW
            HTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz
            /HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKay
            CQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgT
            YSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9c
            gI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJ
            vQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAy
            rxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJ
            NwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ
            7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5D
            PkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9
            aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX
            0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrm
            OeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rk
            ZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFG
            gsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2qqaE5QzNK
            M1ezUvOUZj8H45hx+Jx0TgnnKKeX836K3hTvKeIpG6Y0TLkxZVxrqpaXl
            lirSKtRq0frvTau7aedpr1Fu1n7gQ5Bx0onXCdHZ4/OBZ3nU9lT3acKpx
            ZNPTr1ri6qa6UbobtEd79up+6Ynr5egJ5Mb6feeb3n+hx9L/1U/W36p/V
            HDFgGswwkBtsMzhg8xTVxbzwdL8fb8VFDXcNAQ6VhlWGX4YSRudE8o9VG
            jUYPjGnGXOMk423GbcajJgYmISZLTepN7ppSTbmmKaY7TDtMx83MzaLN1
            pk1mz0x1zLnm+eb15vft2BaeFostqi2uGVJsuRaplnutrxuhVo5WaVYVV
            pds0atna0l1rutu6cRp7lOk06rntZnw7Dxtsm2qbcZsOXYBtuutm22fWF
            nYhdnt8Wuw+6TvZN9un2N/T0HDYfZDqsdWh1+c7RyFDpWOt6azpzuP33F
            9JbpL2dYzxDP2DPjthPLKcRpnVOb00dnF2e5c4PziIuJS4LLLpc+Lpsbx
            t3IveRKdPVxXeF60vWdm7Obwu2o26/uNu5p7ofcn8w0nymeWTNz0MPIQ+
            BR5dE/C5+VMGvfrH5PQ0+BZ7XnIy9jL5FXrdewt6V3qvdh7xc+9j5yn+M
            +4zw33jLeWV/MN8C3yLfLT8Nvnl+F30N/I/9k/3r/0QCngCUBZwOJgUGB
            WwL7+Hp8Ib+OPzrbZfay2e1BjKC5QRVBj4KtguXBrSFoyOyQrSH355jOk
            c5pDoVQfujW0Adh5mGLw34MJ4WHhVeGP45wiFga0TGXNXfR3ENz30T6RJ
            ZE3ptnMU85ry1KNSo+qi5qPNo3ujS6P8YuZlnM1VidWElsSxw5LiquNm5
            svt/87fOH4p3iC+N7F5gvyF1weaHOwvSFpxapLhIsOpZATIhOOJTwQRAq
            qBaMJfITdyWOCnnCHcJnIi/RNtGI2ENcKh5O8kgqTXqS7JG8NXkkxTOlL
            OW5hCepkLxMDUzdmzqeFpp2IG0yPTq9MYOSkZBxQqohTZO2Z+pn5mZ2y6
            xlhbL+xW6Lty8elQfJa7OQrAVZLQq2QqboVFoo1yoHsmdlV2a/zYnKOZa
            rnivN7cyzytuQN5zvn//tEsIS4ZK2pYZLVy0dWOa9rGo5sjxxedsK4xUF
            K4ZWBqw8uIq2Km3VT6vtV5eufr0mek1rgV7ByoLBtQFr6wtVCuWFfevc1
            +1dT1gvWd+1YfqGnRs+FYmKrhTbF5cVf9go3HjlG4dvyr+Z3JS0qavEuW
            TPZtJm6ebeLZ5bDpaql+aXDm4N2dq0Dd9WtO319kXbL5fNKNu7g7ZDuaO
            /PLi8ZafJzs07P1SkVPRU+lQ27tLdtWHX+G7R7ht7vPY07NXbW7z3/T7J
            vttVAVVN1WbVZftJ+7P3P66Jqun4lvttXa1ObXHtxwPSA/0HIw6217nU1
            R3SPVRSj9Yr60cOxx++/p3vdy0NNg1VjZzG4iNwRHnk6fcJ3/ceDTrado
            x7rOEH0x92HWcdL2pCmvKaRptTmvtbYlu6T8w+0dbq3nr8R9sfD5w0PFl
            5SvNUyWna6YLTk2fyz4ydlZ19fi753GDborZ752PO32oPb++6EHTh0kX/
            i+c7vDvOXPK4dPKy2+UTV7hXmq86X23qdOo8/pPTT8e7nLuarrlca7nue
            r21e2b36RueN87d9L158Rb/1tWeOT3dvfN6b/fF9/XfFt1+cif9zsu72X
            cn7q28T7xf9EDtQdlD3YfVP1v+3Njv3H9qwHeg89HcR/cGhYPP/pH1jw9
            DBY+Zj8uGDYbrnjg+OTniP3L96fynQ89kzyaeF/6i/suuFxYvfvjV69fO
            0ZjRoZfyl5O/bXyl/erA6xmv28bCxh6+yXgzMV70VvvtwXfcdx3vo98PT
            +R8IH8o/2j5sfVT0Kf7kxmTk/8EA5jz/GMzLdsAAAAgY0hSTQAAeiUAAI
            CDAAD5/wAAgOkAAHUwAADqYAAAOpgAABdvkl/FRgAAAalJREFUeNqk0rG
            O0zAcx/GvU6dqdWpACmKALUiIserM3tdgZeOp+iB5gltBJ2ikolMpoaR1
            ksaO7RtCW0XNTWSx9Psrn/wcW3jv+Z9HrlYrH0URQojewHvP91zwS8lrd
            pnB69EjXz5/EjJJEhaLBcAFObd6eKzJjy21dqiT5XiyFJXlb2nRv3ddA2
            stUspegzOQHzS7QtM6T+sA55lIeDENaFx7Bay1CCF6Dbz3GOs4tR7Tepr
            WU2tPqT3q5Ahr3QF1XaO1ZjQa9QDn3L/qrvfioXaoquJVVXVAnudst1vC
            MERKSRiGAARBwKGy5Mrx51CiasNRFTRVgW32zFzRAW3bEoYh1lq01jjnL
            lu4/7ZjvWt6pxOM7wjGd7T7rAPSNCVN097PO68v37zn47sPN2cvhOBHce
            qA9Xr97CVZLpckydtB4OfX7iPSGEPTNINA0zRorW/yIAgwxnSA1pqyLAc
            BpdTgTErZB5RSg0BRFOz3+5t8Op1eAWPMsw3yPGc2m93kURRdAYD5fD4I
            xHHMZDK5ycfj8RWI45gkSQaBLMvIsmxwttlsAHgaAK7VFk0V7prNAAAAA
            ElFTkSuQmCC
        ]]></data>.toString().replace(/\s/g,''),

        // I hate trailing commas.
        EOF:null
    };
})().init();

// Initialize the command, register handlers for startup and page load.
// TODO: Find a way to roll all of this into init()?
share_on_delicious_cmd.init();
function startup_share_on_delicious_cmd() {
    share_on_delicious_cmd.onStartup();
}
function pageLoad_share_on_delicious_cmd(doc) {
    share_on_delicious_cmd.onPageLoad(doc);
}
