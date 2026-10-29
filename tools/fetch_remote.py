#!/usr/bin/env python3
"""Recursively fetch files from a remote host over SFTP."""
import os, stat, sys, paramiko

def walk(sftp, remote, local):
    try:
        st = sftp.stat(remote)
    except IOError:
        print(f"MISSING {remote}")
        return
    if stat.S_ISDIR(st.st_mode):
        os.makedirs(local, exist_ok=True)
        for name in sftp.listdir(remote):
            walk(sftp, remote.rstrip('/') + '/' + name, os.path.join(local, name))
    else:
        os.makedirs(os.path.dirname(local) or '.', exist_ok=True)
        sftp.get(remote, local)
        print(f"OK {remote} -> {local} ({os.path.getsize(local)} bytes)")

def main():
    host, user, pw, remote, local = sys.argv[1:6]
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, user, pw, timeout=10)
    sftp = c.open_sftp()
    walk(sftp, remote.rstrip('/'), local.rstrip('/'))
    sftp.close(); c.close()

if __name__ == '__main__':
    main()
