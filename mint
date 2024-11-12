#!/bin/bash
rm acceptcookies.zip
rm release/*
perl -pi -e 'if($_ =~ /"version": "(\d\.\d\d)"/) { my $v = $1 + .01; $_ =~ s/$1/$v/;}' manifest.json
cp manifest.json icon*png release/
for f in *.js;do
	npx javascript-obfuscator "$f" --output release/"$f"
done
zip -j acceptcookies.zip release/*
