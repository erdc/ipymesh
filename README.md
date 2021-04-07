
# ipymesh

[![Build Status](https://travis-ci.org/erdc/ipymesh.svg?branch=master)](https://travis-ci.org/erdc/ipymesh)
[![codecov](https://codecov.io/gh/erdc/ipymesh/branch/master/graph/badge.svg)](https://codecov.io/gh/erdc/ipymesh)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/erdc/ipymesh/master?filepath=examples%2FPSLG.ipynb)

A Custom Jupyter Widget Library for Meshing

## Installation

You can install using `pip`:

```bash
pip install ipymesh
```

If you are using Jupyter Notebook 5.2 or earlier, you may also need to enable
the nbextension:
```bash
jupyter nbextension enable --py [--sys-prefix|--user|--system] ipymesh
```

## Development Installation

Create a dev environment:
```bash
conda create -n ipymesh-dev -c conda-forge nodejs yarn python jupyterlab
conda activate ipymesh-dev
```

Install the python. This will also build the TS package.
```bash
pip install -e ".[test, examples]"
```

When developing your extensions, you need to manually enable your extensions with the
notebook / lab frontend. For lab, this is done by the command:

```
jupyter labextension develop --overwrite .
yarn run build
```

For classic notebook, you need to run:

```
jupyter nbextension install --sys-prefix --symlink --overwrite --py ipymesh
jupyter nbextension enable --sys-prefix --py ipymesh
```

Note that the `--symlink` flag doesn't work on Windows, so you will here have to run
the `install` command every time that you rebuild your extension. For certain installations
you might also need another flag instead of `--sys-prefix`, but we won't cover the meaning
of those flags here.

### How to see your changes
#### Typescript:
If you use JupyterLab to develop then you can watch the source directory and run JupyterLab at the same time in different
terminals to watch for changes in the extension's source and automatically rebuild the widget.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
yarn run watch
# Run JupyterLab in another terminal
jupyter lab
```

After a change wait for the build to finish and then refresh your browser and the changes should take effect.

#### Python:
If you make a change to the python code then you will need to restart the notebook kernel to have it take effect.

## Contributing
 
If you are interested in contributing to this project, please review
`CONTRIBUTING.md` and `LICENSE.txt`. Those files describe how to
contribute to this work.
 
Works created by U.S. Federal employees as part of their jobs
typically are not eligible for copyright in the United States. In
places where the contributions of U.S. Federal employees are not
eligible for copyright, this work is in the public domain. In places
where it is eligible for copyright, such as some foreign
jurisdictions, this work is licensed as described in `LICENSE.txt`.
