# Oracle Cloud Cinema companion

This deploys the existing private, single-stream Cinema companion. It is not an
unlimited public streaming service. It supports browser-compatible MP4, WebM and
Ogg files, HTTP seeking, a 2 GiB torrent limit and 15-minute idle cleanup. Starting
another title replaces the current stream. There is no transcoding.

## Resource selection

Use an Always Free eligible Ubuntu 24.04 Ampere A1 instance in the tenancy's home
region, with 1 OCPU, 6 GB RAM and the minimum boot volume (normally 50 GB). Check
the console's current free allowances and existing usage before creating it. Do
not use trial credits as evidence that a paid shape is permanently free. Oracle
can reclaim idle instances and free capacity is not guaranteed.

Official limits: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

Use a public subnet with an Internet Gateway. Allow SSH only from the owner's
current IP, and TCP 80/443 for HTTPS. The companion's port 8787 is never published.
Keep default outbound connectivity for torrent peer discovery and transfer.
Outbound-only peer connections can work without exposing an inbound peer port.
Preserve Oracle's platform firewall rules; do not flush iptables.

## Install

Install Docker Engine and its Compose plugin from Docker's official Ubuntu
repository: https://docs.docker.com/engine/install/ubuntu/ . Clone the source and
check out the intended release. From `companions/cinema/oracle`:

```sh
cp .env.example .env
chmod 600 .env
# Set CINEMA_DOMAIN to a DNS name pointing to the VM's public IPv4 address.
# Generate CINEMA_TOKEN with openssl rand -hex 32; keep it private.
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
curl --fail https://YOUR_HOSTNAME/ready
```

Caddy automatically obtains and renews HTTPS certificates. DNS and inbound 80/443
must work first. A hostname is required by this configuration. Never commit `.env`
or place the access token in the public Cinema website. In Cinema's **Add-ons &
server**, enter the HTTPS address and token and test the connection. The token
stays in that tab's memory. Both standalone Cinema and NebulaHub are allowed.

## Limits and operations

Downloads use a 2.5 GiB temporary memory filesystem; restarting the container
removes them. The companion has a 4 GiB memory ceiling and Caddy 256 MiB, leaving
headroom on a 6 GB VM. Caddy certificate volumes persist. Container logs rotate;
HTTP access logging is disabled to avoid retaining private media URLs.

Use `sudo docker compose logs --tail 100 cinema` for failures. To update, pull the
reviewed source and run `sudo docker compose up -d --build`. Updates interrupt the
active stream. To stop, use `sudo docker compose down` (without `-v` to preserve
certificates). Configure OCI usage alerts and monitor outbound bandwidth. Free
resource labels do not make unlimited traffic free. Use media you may access.

Validate with `npm ci && npm test` in `companions/cinema`. The integration test
transfers real generated torrent bytes and checks authentication, CORS and seeking.
After deploying, also verify HTTPS health, unauthorized rejection, and playback
with a permitted browser-compatible test torrent. Passing local tests alone does
not establish that Oracle's network can reach external peers.
