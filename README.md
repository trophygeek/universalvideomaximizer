# universalvideomaximizer
Chrome extension that finds and enlarges the main video filling browser window.


# Configure Webstorm to recognize `chrome.*` calls.
The package.json includes `@type/chrome` which includes the API calls for chrome extensions. 

Just added the `./node_modules/@types/chrome` directory. After running `yarn install`

<img src="https://user-images.githubusercontent.com/522197/149636567-beee38aa-b386-4a63-8507-84d3b6495bd3.png" width="450px">


# ToDo items

 - Get eslint to use the `./node_modules/@types/chrome` directory for the `chrome.*` calls.
 - Get build/package that turns off debugger modes
 - Combine common functions in a single include file


