#!/bin/bash
echo "Running Vite with arguments: $@"
echo "If you tried to npm run dev, build, or preview, make sure to use '--'(double dash) before the arguments."
cd apps/$1 && vite preview ${@:2}
#  "dev": "cd apps/$1 && vite --host=0.0.0.0",
#     "build": "cd apps/$1 && vite build ${@:2}",
#     "preview": "cd apps/$1 && vite preview ${@:2}",