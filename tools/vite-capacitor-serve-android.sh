#!/bin/bash
set -euo pipefail

source .env

mode="${1:-run}"
app="${2:-}"

if [[ -z "$app" ]]; then
	echo "Usage: $0 <run|production> <app> [vite arguments...]" >&2
	exit 1
fi

if [[ "$mode" != "run" && "$mode" != "production" ]]; then
	echo "Unknown mode: $mode" >&2
	exit 1
fi

if [[ "$mode" == "production" ]]; then
	required_variables=(
		GRADLE_JDK
		ANDROID_HOME
		ANDROID_KEYSTORE_PATH
		ANDROID_KEYSTORE_PASSWORD
		ANDROID_KEY_ALIAS
		ANDROID_KEY_PASSWORD
	)

	for variable_name in "${required_variables[@]}"; do
		if [[ -z "${!variable_name:-}" ]]; then
			echo "Missing production signing variable: $variable_name" >&2
			exit 1
		fi
	done

	if [[ ! -f "$ANDROID_KEYSTORE_PATH" ]]; then
		echo "Android keystore not found: $ANDROID_KEYSTORE_PATH" >&2
		exit 1
	fi
fi

echo "Building Android app '$app' in '$mode' mode"
cd "apps/$app"
npm install
vite build "${@:3}"
npx cap sync android

if [[ "$mode" == "production" ]]; then
	(
		cd android
		JAVA_HOME="$GRADLE_JDK" \
			ANDROID_HOME="$ANDROID_HOME" \
			ANDROID_KEYSTORE_PATH="$ANDROID_KEYSTORE_PATH" \
			ANDROID_KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD" \
			ANDROID_KEY_ALIAS="$ANDROID_KEY_ALIAS" \
			ANDROID_KEY_PASSWORD="$ANDROID_KEY_PASSWORD" \
			./gradlew bundleRelease
	)
	echo "App Bundle: $PWD/android/app/build/outputs/bundle/release/app-release.aab"
elif [[ "$mode" == "run" ]]; then
	JAVA_HOME="$GRADLE_JDK" ANDROID_HOME="$ANDROID_HOME" ANDROID_JDK="${ANDROID_JDK:-}" npx cap run android
fi