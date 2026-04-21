# FitQuest Kubernetes Troubleshooting Guide

Common issues and solutions for FitQuest Kubernetes infrastructure.

## Cluster Access Issues

### Issue: "Unable to connect to the server"

**Symptoms:**
```
Unable to connect to the server: dial tcp: lookup on <ip>: no such host
```

**Solutions:**

1. Check kubeconfig:
```bash
kubectl config view
kubectl config current-context
```

2. Verify cluster is running:
```bash
# AWS EKS
aws eks describe-cluster --name fitquest-cluster --region us-east-1

# Azure AKS
az aks show --resource-group fitquest-rg --name fitquest-cluster
```

3. Update kubeconfig:
```bash
# AWS EKS
aws eks update-kubeconfig --name fitquest-cluster --region us-east-1

# Azure AKS
az aks get-credentials --resource-group fitquest-rg --name fitquest-cluster
```

4. Check network connectivity:
```bash
ping <cluster-endpoint>
telnet <cluster-endpoint> 443
```

### Issue: "Unauthorized" or "Forbidden"

**Symptoms:**
```
error: You must be logged in to the server (Unauthorized)
```

**Solutions:**

1. Check credentials:
```bash
# AWS
aws sts get-caller-identity

# Azure
az account show
```

2. Re-authenticate:
```bash
# AWS
aws configure

# Azure
az login
```

3. Check RBAC permissions:
```bash
kubectl auth can-i get pods --as=system:serviceaccount:fitquest:fitquest-sa
```

## Node Issues

### Issue: Nodes Not Ready

**Symptoms:**
```
kubectl get nodes
NAME                          STATUS     ROLES    AGE   VERSION
ip-10-0-1-100.ec2.internal   NotReady   <none>   5m    v1.27.0
```

**Solutions:**

1. Check node status:
```bash
kubectl describe node <node-name>
kubectl get events -n kube-system
```

2. Check kubelet logs:
```bash
# SSH into node
ssh ec2-user@<node-ip>

# Check kubelet status
sudo systemctl status kubelet
sudo journalctl -u kubelet -n 50
```

3. Common causes:
   - Insufficient resources (CPU, memory, disk)
   - Network connectivity issues
   - Container runtime not running
   - CNI plugin not installed

4. Fix insufficient resources:
```bash
# Check node resources
kubectl describe node <node-name> | grep -A 5 "Allocated resources"

# Add more nodes
# AWS EKS
aws autoscaling set-desired-capacity --auto-scaling-group-name <asg-name> --desired-capacity 5

# Azure AKS
az aks nodepool scale --resource-group fitquest-rg --cluster-name fitquest-cluster --name nodepool1 --node-count 5
```

### Issue: Node Disk Pressure

**Symptoms:**
```
kubectl describe node <node-name>
Conditions:
  DiskPressure   True
```

**Solutions:**

1. Check disk usage:
```bash
ssh ec2-user@<node-ip>
df -h
du -sh /var/lib/docker/*
```

2. Clean up Docker images:
```bash
docker image prune -a
docker container prune
```

3. Clean up Kubernetes:
```bash
kubectl delete pod --all -n fitquest
kubectl delete pvc --all -n fitquest
```

## Namespace Issues

### Issue: Namespace Stuck in Terminating

**Symptoms:**
```
kubectl get namespace fitquest
NAME       STATUS        AGE
fitquest   Terminating   10m
```

**Solutions:**

1. Check what's preventing deletion:
```bash
kubectl api-resources --verbs=list --namespaced=true -o name | xargs -n 1 kubectl get --show-kind --ignore-not-found -n fitquest
```

2. Remove finalizers:
```bash
kubectl get namespace fitquest -o json | jq '.spec.finalizers = []' | kubectl replace --raw /api/v1/namespaces/fitquest/finalize -f -
```

3. Force delete:
```bash
kubectl delete namespace fitquest --grace-period=0 --force
```

### Issue: Resource Quota Exceeded

**Symptoms:**
```
Error from server (Forbidden): error when creating "deployment.yaml": pods "pod-name" is forbidden: exceeded quota: fitquest-quota, requested: cpu=2, used: cpu=98, limited: cpu=100
```

**Solutions:**

1. Check resource usage:
```bash
kubectl describe resourcequota -n fitquest
kubectl top pods -n fitquest
```

2. Increase quota:
```bash
kubectl edit resourcequota fitquest-quota -n fitquest
```

3. Optimize resource requests:
```bash
# Review pod resource requests
kubectl get pods -n fitquest -o json | jq '.items[].spec.containers[].resources'
```

## Pod Issues

### Issue: Pod Stuck in Pending

**Symptoms:**
```
kubectl get pods -n fitquest
NAME                    READY   STATUS    RESTARTS   AGE
authentication-pod      0/1     Pending   0          5m
```

**Solutions:**

1. Check pod events:
```bash
kubectl describe pod <pod-name> -n fitquest
```

2. Common causes:
   - Insufficient resources
   - Node selector not matching
   - PVC not bound
   - Image pull error

3. Check resource availability:
```bash
kubectl describe nodes
kubectl top nodes
```

4. Check image pull:
```bash
kubectl describe pod <pod-name> -n fitquest | grep -A 5 "Events"
```

### Issue: Pod Crash Loop

**Symptoms:**
```
kubectl get pods -n fitquest
NAME                    READY   STATUS             RESTARTS   AGE
authentication-pod      0/1     CrashLoopBackOff   5          5m
```

**Solutions:**

1. Check pod logs:
```bash
kubectl logs <pod-name> -n fitquest
kubectl logs <pod-name> -n fitquest --previous
```

2. Describe pod:
```bash
kubectl describe pod <pod-name> -n fitquest
```

3. Common causes:
   - Application error
   - Missing environment variables
   - Database connection failure
   - Configuration error

4. Debug pod:
```bash
kubectl exec -it <pod-name> -n fitquest -- /bin/bash
```

### Issue: Pod ImagePullBackOff

**Symptoms:**
```
kubectl get pods -n fitquest
NAME                    READY   STATUS             RESTARTS   AGE
authentication-pod      0/1     ImagePullBackOff   0          5m
```

**Solutions:**

1. Check image:
```bash
kubectl describe pod <pod-name> -n fitquest | grep -A 5 "Image"
```

2. Verify image exists:
```bash
docker pull <image-name>
```

3. Check registry credentials:
```bash
kubectl get secret docker-hub-secret -n fitquest -o yaml
```

4. Recreate secret:
```bash
kubectl delete secret docker-hub-secret -n fitquest
kubectl create secret docker-registry docker-hub-secret \
  --docker-server=docker.io \
  --docker-username=<username> \
  --docker-password=<password> \
  -n fitquest
```

## Network Issues

### Issue: Service Not Accessible

**Symptoms:**
```
kubectl get svc -n fitquest
NAME                    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)
authentication-service  ClusterIP   10.0.0.100      <none>        8080/TCP
```

**Solutions:**

1. Check service:
```bash
kubectl describe svc <service-name> -n fitquest
```

2. Check endpoints:
```bash
kubectl get endpoints <service-name> -n fitquest
```

3. Test connectivity:
```bash
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://<service-name>:8080
```

4. Check network policy:
```bash
kubectl get networkpolicy -n fitquest
kubectl describe networkpolicy <policy-name> -n fitquest
```

### Issue: DNS Not Resolving

**Symptoms:**
```
nslookup: can't resolve 'authentication-service.fitquest.svc.cluster.local'
```

**Solutions:**

1. Check DNS pod:
```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
```

2. Check DNS logs:
```bash
kubectl logs -n kube-system -l k8s-app=kube-dns
```

3. Test DNS:
```bash
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup kubernetes.default
```

4. Restart DNS:
```bash
kubectl rollout restart deployment coredns -n kube-system
```

## Storage Issues

### Issue: PVC Stuck in Pending

**Symptoms:**
```
kubectl get pvc -n fitquest
NAME              STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
data-pvc          Pending                                       standard       5m
```

**Solutions:**

1. Check PVC:
```bash
kubectl describe pvc <pvc-name> -n fitquest
```

2. Check storage class:
```bash
kubectl get storageclass
kubectl describe storageclass <storage-class-name>
```

3. Check PV:
```bash
kubectl get pv
```

4. Create storage class:
```bash
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp2
  iops: "100"
  fstype: ext4
EOF
```

## RBAC Issues

### Issue: Permission Denied

**Symptoms:**
```
Error from server (Forbidden): error when creating "deployment.yaml": deployments.apps is forbidden: User "system:serviceaccount:fitquest:fitquest-sa" cannot create resource "deployments" in API group "apps" in the namespace "fitquest"
```

**Solutions:**

1. Check RBAC:
```bash
kubectl get role -n fitquest
kubectl get rolebinding -n fitquest
```

2. Check permissions:
```bash
kubectl auth can-i create deployments --as=system:serviceaccount:fitquest:fitquest-sa -n fitquest
```

3. Create role:
```bash
kubectl create role deployment-creator --verb=create --resource=deployments -n fitquest
kubectl create rolebinding deployment-creator-binding --clusterrole=deployment-creator --serviceaccount=fitquest:fitquest-sa -n fitquest
```

## Monitoring Issues

### Issue: Metrics Not Available

**Symptoms:**
```
kubectl top nodes
error: metrics not available yet
```

**Solutions:**

1. Check metrics server:
```bash
kubectl get deployment -n kube-system metrics-server
```

2. Install metrics server:
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

3. Wait for metrics:
```bash
# Metrics take 1-2 minutes to appear
sleep 120
kubectl top nodes
```

## Logging Issues

### Issue: Logs Not Available

**Symptoms:**
```
kubectl logs <pod-name> -n fitquest
Error from server (BadRequest): container "app" in pod "pod-name" is waiting to be started: PodInitializing
```

**Solutions:**

1. Wait for pod to start:
```bash
kubectl wait --for=condition=ready pod/<pod-name> -n fitquest --timeout=300s
```

2. Check pod status:
```bash
kubectl describe pod <pod-name> -n fitquest
```

3. Check previous logs:
```bash
kubectl logs <pod-name> -n fitquest --previous
```

## Performance Issues

### Issue: Slow API Response

**Symptoms:**
- kubectl commands taking > 5 seconds
- API server high latency

**Solutions:**

1. Check API server:
```bash
kubectl get componentstatuses
```

2. Check etcd:
```bash
kubectl get pods -n kube-system -l component=etcd
```

3. Check resource usage:
```bash
kubectl top nodes
kubectl top pods -n kube-system
```

4. Scale up:
```bash
# Add more nodes
# AWS EKS
aws autoscaling set-desired-capacity --auto-scaling-group-name <asg-name> --desired-capacity 5

# Azure AKS
az aks nodepool scale --resource-group fitquest-rg --cluster-name fitquest-cluster --name nodepool1 --node-count 5
```

## Getting Help

1. Check logs:
```bash
kubectl logs <pod-name> -n fitquest
kubectl logs <pod-name> -n fitquest --previous
```

2. Describe resources:
```bash
kubectl describe pod <pod-name> -n fitquest
kubectl describe node <node-name>
```

3. Check events:
```bash
kubectl get events -n fitquest
kubectl get events -A --sort-by='.lastTimestamp'
```

4. Debug pod:
```bash
kubectl debug pod/<pod-name> -n fitquest -it --image=busybox
```

5. Check cluster info:
```bash
kubectl cluster-info dump --output-directory=./cluster-dump
```
