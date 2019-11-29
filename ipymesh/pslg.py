import ipywidgets as widgets
from ipywidgets import FloatText, Dropdown, Label
from traitlets import Unicode, Float, Int, Tuple, Bool, List, validate, Instance, Bytes, observe
from IPython.display import display

@widgets.register('ipymesh.PSLGEditor')
class PSLGEditor(widgets.DOMWidget):
    """Plot and edit Planar Straight Line Graphs"""
    _view_name = Unicode('PSLGEditorView').tag(sync=True)
    _model_name = Unicode('PSLGEditorModel').tag(sync=True)
    _model_module = Unicode('ipymesh-widgets').tag(sync=True)
    _view_module = Unicode('ipymesh-widgets').tag(sync=True)
    _view_module_version = Unicode('^0.1.4').tag(sync=True)
    _model_module_version = Unicode('^0.1.4').tag(sync=True)
    _sync_toggle = Bool().tag(sync=True)
    width = Int().tag(sync=True)
    height = Int().tag(sync=True)
    Lx = Float(1.0).tag(sync=True)
    Ly = Float(1.0).tag(sync=True)
    image = Bytes().tag(sync=True)
    x0 = Float(0.0).tag(sync=True)
    y0 = Float(0.0).tag(sync=True)
    vertices = List().tag(sync=True)
    vertexFlags = List().tag(sync=True)
    segments = List().tag(sync=True)
    segmentFlags = List().tag(sync=True)
    regions = List().tag(sync=True)
    regionFlags = List().tag(sync=True)
    holes = List().tag(sync=True)
    boundaryTypes = List().tag(sync=True)
    boundary_type = Int().tag(sync=True)
    regionTypes = List().tag(sync=True)
    region_type = Int().tag(sync=True)
    add_new = Unicode().tag(sync=True)
    xy = List().tag(sync=True)

    def __init__(self,
                 vertices=[[300,300]],
                 vertexFlags=[1],
                 segments=[],
                 segmentFlags=[],
                 regions=[],
                 regionFlags=[],
                 holes=[],
                 boundaryTypes=[1,0],
                 boundary_type=0,
                 regionTypes=[1,0],
                 region_type=0,
                 add_new='Vertex',
                 width=600,
                 height=600,
                 Lx=1.0,
                 Ly=1.0,
                 image_filename='',
                 x0=0.0,
                 y0=0.0,
                 regionConstraints=None,
                 name="DefaultPSLGDomain",
                 units="m",
                 fileprefix=None,
                 *args,**kwargs):
        super(PSLGEditor, self).__init__(*args, **kwargs)
        self.vertices=vertices
        self.vertexFlags=vertexFlags
        self.segments=segments
        self.segmentFlags=segmentFlags
        self.regions=regions
        self.regionFlags=regionFlags
        self.holes=holes
        self.width=width
        self.height=height
        self.Lx=Lx
        self.Ly=Ly
        if image_filename:
            with open(image_filename, 'rb') as f:
                self.image = f.read()
        self.x0=x0
        self.y0=y0
        self.boundaryTypes = boundaryTypes
        self.regionTypes = regionTypes
        self._sync_toggle=True
        self.polyfile = None
        self.regionConstraints = regionConstraints or []
        self.name=name
        self.units=units
        self.use_gmsh=False

        self.select_boundary = Dropdown(options=self.boundaryTypes, description='Boundary:', disable=False)
        self.select_region = Dropdown(options=self.regionTypes, description='Region:', disable=False)
        self.select_add = Dropdown(options=[u'Vertex \u25cf', u'Region \u25a0', u'Hole \u25b2'], description='Add:', disable=False)
        self.enter_x = FloatText(description='x:')
        self.enter_y = FloatText(description='y:')
        self.boundary_type = self.select_boundary.value
        self.region_type = self.select_region.value
        self.add_new = self.select_add.value[:-2].lower()
        def on_boundary_change(change):
            self.boundary_type = change['new']
        def on_region_change(change):
            self.region_type = change['new']
        def on_add_change(change):
            self.add_new = change['new'][:-2].lower()
        def on_x_change(change):
            self.xy = [change['new'], self.xy[1]]
        def on_y_change(change):
            self.xy = [self.xy[0], change['new']]
        self.select_boundary.observe(on_boundary_change, names='value')
        self.select_region.observe(on_region_change, names='value')
        self.select_add.observe(on_add_change, names='value')
        self.enter_x.observe(on_x_change, names='value')
        self.enter_y.observe(on_y_change, names='value')
        self.help = Label('Click to add vertex, region or hole. Press Delete to remove selection. Press CTRL to drag.')
    def sync(self):
        self._sync_toggle = not self._sync_toggle

    @observe('xy')
    def update_xy(self, change):
        self.enter_x.value = self.xy[0]
        self.enter_y.value = self.xy[1]

    def _ipython_display_(self, **kwargs):
        super(PSLGEditor, self)._ipython_display_(**kwargs)
        display(self.select_boundary)
        display(self.select_region)
        display(self.select_add)
        display(self.enter_x)
        display(self.enter_y)
        display(self.help)
