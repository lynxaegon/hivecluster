FROM lynxaegon/kube-builder:v1.0

LABEL "com.github.actions.name"="Runner"
LABEL "com.github.actions.description"=""
LABEL "com.github.actions.icon"="cloud-lightning"
LABEL "com.github.actions.color"="green"

LABEL "repository"="https://github.com/lynxaegon/hivecluster"
LABEL "homepage"="https://github.com/lynxaegon/hivecluster"
LABEL "maintainer"="Andrei Vaduva <andrei.vaduva@gmail.com>"

ADD entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
