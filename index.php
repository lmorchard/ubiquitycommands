<html>
    <head>
        <title>0xDECAFBAD - UbiquityCommands<?php echo (isset($_GET['cmd'])) ? ' - '.htmlspecialchars($_GET['cmd']) : '' ?></title>
        <link rel="openid.server" href="http://www.livejournal.com/openid/server.bml">
        <link rel="openid.delegate" href="http://deus-x.livejournal.com">
        <link rel="stylesheet" type="text/css" href="index.css" />
        <link rel="commands" 
            href="<?php echo (isset($_GET['cmd'])) ? htmlspecialchars($_GET['cmd']) : 'all-commands.php' ?>" 
            name="decafbad.com ubiquity commands" />
    </head>
    <body>
        <div class="wrapper">

            <div class="header">
                <h1 class="title"><a href="http://decafbad.com/">0xDECAFBAD</a></h1>
                <h2 class="subtitle">a beverage preference <strong>and</strong> a 32-bit hexadecimal number</h2>
                <ul class="nav">
                    <li class="first title">see also:</li>
                    <li><a href="/">home</a></li>
                    <li><a href="http://decafbad.com/hg?sort=lastchange">code</a></li>
                    <li><a href="/blog">blog</a></li>
                    <li><a href="/blog/lifestream">lifestream</a></li>
                </ul>
                <div class="intro">
                    <p>
                        Hi there!  This page houses my experiments in creating
                        <a href="https://wiki.mozilla.org/Labs/Ubiquity">Mozilla Labs Ubiquity</a>
                        commands.  Feel free to subscribe to them, and hopefully I 
                        won't hose your browser.
                    </p>
                    <h2>Ubiquity commands 
                        <?php if (isset($_GET['cmd'])): ?>
                            (<a href="<?php echo str_replace('index.php', '', $_SERVER['PHP_SELF']) ?>">view all</a>)
                        <?php endif ?></h2>
                    <?php if (!isset($_GET['cmd'])): ?>
                        <p>Click one of the links below to select just a single command for subscription.</p>
                    <?php endif ?>
                    <dl>
                        <?php
                            // Scan the working directory for *.ubiq.js
                            $dir = opendir('.');
                            $suffix = 'ubiq.js';
                            while ( ($file = readdir($dir)) !== FALSE ) {
                                if (substr($file, 0-strlen($suffix)) == $suffix) {

                                    // If a command is selected, skip all but the one selected.
                                    if (isset($_GET['cmd']) && $file !== $_GET['cmd']) continue; 

                                    ?>
                                        <dt><a href="?cmd=<?php echo $file ?>"><?php echo $file ?></a></dt>
                                        <dd>
                                    <?php
                                        // Try to scoop up the description of 
                                        // the command from the first comment in 
                                        // the file. 
                                        $src = file_get_contents($file);
                                        $lines = split("\n", $src);
                                        foreach ($lines as $line) {

                                            // Skip the start of the header comment.
                                            if (strpos($line, '/**') !== FALSE) continue;
                                            
                                            // Stop at the end of the header comment.
                                            if (strpos($line, '*/') !== FALSE)  break;
                                            
                                            // Strip ' * ' prefix from header 
                                            // comment lines and stop on first 
                                            // blank line.
                                            
                                            if (! ($line = substr($line, 3)) )  break;
                                            // Finally, spit out the comment text.
                                            echo $line . ' ';
                                        }
                                    ?></dt><?php
                                }
                            }
                        ?>
                    </dl>
                </div>
            </div>

            <div class="content">
                <img id="growup" src="http://decafbad.com/images/growup.jpg" 
                    width="359" height="111" 
                    alt="This is what I wrote in a 3rd grade report card book" />
            </div>

        </div>

    </body>
</html>
