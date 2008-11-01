<?php
/**
 * Quick and dirty script to concat all *.ubiq.js commands in this directory 
 * into one big command feed.
 *
 * l.m.orchard@pobox.com
 * Share and enjoy
 */
header('Content-Type: text/javascript');
$dir = opendir('.');
$suffix = 'ubiq.js';
while ( ($file = readdir($dir)) !== FALSE ) {
    if (substr($file, 0-strlen($suffix)) == $suffix) {
        $src = file_get_contents($file);
        echo $src;
    }
}
