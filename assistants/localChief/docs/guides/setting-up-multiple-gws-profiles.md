# Setting up Multiple GWS Profiles

1) Install @googleworkspace/cli
2) Install the gcloud sdk
3) gws auth setup to get your project setup

## Login with one profile

4) gws auth login to login
5) copy ~/.config/gws to ~/.config/gws-$profile where $profile is the unique folder for that account

## Login with another

6) Login with the other account 'gws auth login'
7) Copy the config/gws to ~/.config/gws-$another

Now 

```ts
container.feature('gws', { configDir: pathToFirstOne })
container.feature('gws', { configDir: pathToSecondOne })
```

Now these both are authenticated as different accounts

