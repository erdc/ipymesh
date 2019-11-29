
# ipymesh

[![Build Status](https://travis-ci.org/erdc/ipymesh.svg?branch=master)](https://travis-ci.org/erdc/ipymesh)
[![codecov](https://codecov.io/gh/erdc/ipymesh/branch/master/graph/badge.svg)](https://codecov.io/gh/erdc/ipymesh)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/erdc/ipymesh/master?filepath=examples%2FPSLG.ipynb)

A Custom Mesh Widget Library

## Installation

You can install using `pip`:

```bash
pip install ipymesh
```

Or if you use jupyterlab:

```bash
pip install ipymesh
jupyter labextension install @jupyter-widgets/jupyterlab-manager
```

If you are using Jupyter Notebook 5.2 or earlier, you may also need to enable
the nbextension:
```bash
jupyter nbextension enable --py [--sys-prefix|--user|--system] ipymesh
```

For a development installation (requires npm),

    $ git clone https://github.com/erdc/ipymesh.git
    $ cd ipymesh
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix ipymesh
    $ jupyter nbextension enable --py --sys-prefix ipymesh

## Contributing

If you are interested in contributing to this project, please review `CONTRIBUTING.md` and `LICENSE.md`. Those files describe how to contribute to this work.

Works created by U.S. Federal employees as part of their jobs typically are not eligible for copyright in the United States. In places where the contributions of U.S. Federal employees are not eligible for copyright, this work is in the public domain. In places where it is eligible for copyright, such as some foreign jurisdictions, this work is licensed as described in `LICENSE.md`.
