workflow "Build & Deploy" {
  on = "push"
  resolves = ["Build & Deploy"]
}

action "Build & Deploy" {
  uses = "./.github/build-workflow/"
  secrets = ["KUBE_CERTS_DOWNLOADER"]
}
