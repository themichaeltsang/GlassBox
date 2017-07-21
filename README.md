# Project Glass Box

# Installing
```
virtualenv -p `which python3` env
. ./env/bin/activate
pip install --editable .
```

# Running
```
. ./env/bin/activate
. ./start.sh
```


# TODO

- [ ] The curve drawing only works if drawn slowly, and the red marker goes through each point. This can be fixed by going through the live drawn curve segment by segment, like in closestPoint2.
