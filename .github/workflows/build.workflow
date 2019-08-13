name: Build & Deploy
on: [push]

jobs:
  build_and_deploy:
    name: Build & Deploy
    steps:
      - uses: docker://lynxaegon/kube-builder:v1.0
        env:
          KUBE_CERTS_DOWNLOADER: ${{ secrets.KUBE_CERTS_DOWNLOADER }}
