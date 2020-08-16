## Local Development
Below are the steps required to run this app local.

### Installation

0. NVM (NOT NPM): `brew install nvm`

1. Writing alias, IF Bash, type: `echo "source $(brew --prefix nvm)/nvm.sh" >> .bash_profile`

2. Writing alias, IF zsh/oh-my-zsh, type: `echo "source $(brew --prefix nvm)/nvm.sh" >> .zhsrc`

3. Reload profile, IF bash, type: `~/.bash_profile`. IF zsh, type: `. ~/.zshrc`

4. NODE: `nvm use`

5. NPM PACKAGES: `npm install`

6. DOCKER: [web](https://docs.docker.com/docker-for-mac/install/) *Note:* Using homebrew will not work, need to install the docker desktop application.

### Development

0. `npm start`

1. IN A PARALLEL TERMINAL WINDOW `npm run hydrate` (this will hydrate your local database)

2. Happy Coding :)

3. Write tests

4. Create a PR
