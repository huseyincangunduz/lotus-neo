#!/bin/bash
source .env
echo "Running Vite with arguments: $@"
echo "If you tried to npm run dev, build, or preview, make sure to use '--'(double dash) before the arguments."
cd apps/$1
npm install
vite build ${@:2}
npx cap sync
JAVA_HOME=$GRADLE_JDK ANDROID_HOME=$ANDROID_HOME ANDROID_JDK=$ANDROID_JDK npx cap run android