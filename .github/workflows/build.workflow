workflow "Build & Deploy" {
  on = "push"
  resolves = ["Build & Deploy"]
}

action "Build & Deploy" {
  uses = "./.github/actions/build-action/"
  secrets = ["KUBE_CERTS_DOWNLOADER"]
}
