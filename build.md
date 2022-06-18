## Build
Chrome extensions are not compiled. The "build" is just zipping the `/src` directory and that is the package submitted to the chrome store.

## Configure Webstorm to recognize `chrome.*` calls.
The package.json includes `@type/chrome` which includes the API calls for chrome extensions.

Just added the `./node_modules/@types/chrome` directory. After running `yarn install`

<img src="https://user-images.githubusercontent.com/522197/149636567-beee38aa-b386-4a63-8507-84d3b6495bd3.png" width="450px">

