import ipywidgets as widgets
from ipywidgets import FloatText, Dropdown, Label
from traitlets import Unicode, Float, Int, Bool, List, Bytes, observe

class PSLGEditor(widgets.VBox):
    boundaryTypes = List([1, 0]).tag(sync=True)
    regionTypes = List([1, 0]).tag(sync=True)
    def __init__(self, *args,**kwargs):
        super(PSLGEditor, self).__init__(*args, **kwargs)
        self.graph = Graph(*args, **kwargs, parent=self)
        self.select_boundary = Dropdown(options=self.boundaryTypes, description='Boundary:', disable=False)
        self.select_region = Dropdown(options=self.regionTypes, description='Region:', disable=False)
        self.select_add = Dropdown(options=[u'Vertex \u25cf', u'Region \u25a0', u'Hole \u25b2'], description='Add:', disable=False)
        self.enter_x = FloatText(description='x:')
        self.enter_y = FloatText(description='y:')
        self.help = Label('Click to add vertex, region or hole. Press Delete to remove selection. Press CTRL to drag.')
        def on_boundary_change(change):
            self.graph.boundary_type = change['new']
        def on_region_change(change):
            self.graph.region_type = change['new']
        def on_add_change(change):
            self.graph.add_new = change['new'][:-2].lower()
        def on_x_change(change):
            self.graph.xy = [change['new'], self.graph.xy[1]]
        def on_y_change(change):
            self.graph.xy = [self.graph.xy[0], change['new']]
        self.select_boundary.observe(on_boundary_change, names='value')
        self.select_region.observe(on_region_change, names='value')
        self.select_add.observe(on_add_change, names='value')
        self.enter_x.observe(on_x_change, names='value')
        self.enter_y.observe(on_y_change, names='value')
        self.graph.boundary_type = self.select_boundary.value
        self.graph.region_type = self.select_region.value
        self.graph.add_new = self.select_add.value[:-2].lower()
        self.children = [self.graph, self.select_boundary, self.select_region, self.select_add, self.enter_x, self.enter_y, self.help]





@widgets.register('ipymesh.PSLGEditor')
class Graph(widgets.DOMWidget):
    """Plot and edit Planar Straight Line Graphs"""
    _view_name = Unicode('PSLGEditorView').tag(sync=True)
    _model_name = Unicode('PSLGEditorModel').tag(sync=True)
    _model_module = Unicode('ipymesh-widgets').tag(sync=True)
    _view_module = Unicode('ipymesh-widgets').tag(sync=True)
    _view_module_version = Unicode('^0.1.7').tag(sync=True)
    _model_module_version = Unicode('^0.1.7').tag(sync=True)
    _sync_toggle = Bool().tag(sync=True)
    width = Int(600).tag(sync=True)
    height = Int(600).tag(sync=True)
    Lx = Float(1.0).tag(sync=True)
    Ly = Float(1.0).tag(sync=True)
    image = Bytes().tag(sync=True)
    image_filename = Unicode('').tag(sync=True)
    x0 = Float(0.0).tag(sync=True)
    y0 = Float(0.0).tag(sync=True)
    vertices = List([[300, 300]]).tag(sync=True)
    vertexFlags = List([1]).tag(sync=True)
    segments = List([]).tag(sync=True)
    segmentFlags = List([]).tag(sync=True)
    regions = List([]).tag(sync=True)
    regionFlags = List([]).tag(sync=True)
    holes = List([]).tag(sync=True)
    boundary_type = Int(0).tag(sync=True)
    region_type = Int(0).tag(sync=True)
    add_new = Unicode('Vertex').tag(sync=True)
    xy = List().tag(sync=True)

    def __init__(self, *args,**kwargs):
        super(Graph, self).__init__(*args, **kwargs)

        if self.image_filename:
            with open(self.image_filename, 'rb') as f:
                self.image = f.read()
        self._sync_toggle=True
        self.parent = kwargs['parent']

    def sync(self):
        self._sync_toggle = not self._sync_toggle

    @observe('xy')
    def update_xy(self, change):
        self.parent.enter_x.value = self.xy[0]
        self.parent.enter_y.value = self.xy[1]
