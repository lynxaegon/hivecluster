action "Build & Deploy" {
  uses = "./action-build/"
  secrets = ["KUBE_CERTS_DOWNLOADER"]
}
