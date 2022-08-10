# dotStorage-tools

Administrative CLI tools for developers working on dotStorage.

## Usage

Clone the repo, install deps (`npm install`) then (`npm link`) and then:

```console
$ dotstorage --help

  Usage
    $ dotstorage <command> [options]

  Available Commands
    list-cluster-ipfs-peers    Display IPFS peers in the Cluster
    show-cluster-cid-status    Show the status for a CID in Cluster
    is-dag-complete            Determine if a CAR file(s) contains a complete DAG
    find-advert                Find the advertisement file that contains a CID

  For more info, run any command with the `--help` flag
    $ dotstorage list-cluster-ipfs-peers --help
    $ dotstorage show-cluster-cid-status --help

  Options
    -v, --version    Displays current version
    -h, --help       Displays this message
```
