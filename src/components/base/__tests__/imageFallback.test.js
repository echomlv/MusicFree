jest.mock('react-native-fast-image',()=>({__esModule:true,default:'MockFastImage'}));
const React=require('react');
const renderer=require('react-test-renderer');
const {Image}=require('react-native');
const FastImage=require('../fastImage').default;
const BasicImage=require('../image').default;
const uri='https://p1.music.126.net/C-OacRqh41bAq-75Y4DDkg==/109951166367895646.jpg';
const style={width:100,height:100};
let tree;
beforeEach(()=>jest.spyOn(console,'warn').mockImplementation(()=>{}));
afterEach(()=>{if(tree)renderer.act(()=>tree.unmount());tree=null;jest.restoreAllMocks();});
const mount=source=>renderer.act(()=>{tree=renderer.create(React.createElement(FastImage,{source,style,placeholderSource:42}));});
it('tries the same URI and headers with native Image once when FastImage fails',()=>{
  mount({uri,headers:{Referer:'https://music.163.com/'}});
  renderer.act(()=>tree.root.findByType('MockFastImage').props.onError());
  const fallback=tree.root.findByType(Image);
  expect(fallback.props.source).toEqual({uri,headers:{Referer:'https://music.163.com/'}});
  expect(fallback.props.defaultSource).toBe(42);
  renderer.act(()=>fallback.props.onLoad?.());
  expect(tree.root.findByType(Image).props.source.uri).toBe(uri);
  expect(console.warn).not.toHaveBeenCalled();
});
it('does not retry FastImage for an equivalent source object and ignores late errors for an old URI',()=>{
  mount({uri});
  const late=tree.root.findByType('MockFastImage').props.onError;
  renderer.act(()=>late());
  renderer.act(()=>tree.update(React.createElement(FastImage,{source:{uri},style,placeholderSource:42})));
  expect(tree.root.findAllByType('MockFastImage')).toHaveLength(0);
  renderer.act(()=>tree.update(React.createElement(FastImage,{source:{uri:uri+'?param=480y480'},style,placeholderSource:42})));
  renderer.act(()=>late());
  expect(tree.root.findByType('MockFastImage').props.source.uri).toBe(uri+'?param=480y480');
});
it('ends on the local placeholder after both loaders fail and reports the native error once',()=>{
  mount(uri);
  renderer.act(()=>tree.root.findByType('MockFastImage').props.onError());
  const failed=tree.root.findByType(Image).props.onError;
  renderer.act(()=>{failed({nativeEvent:{error:'Network connection lost'}});failed({nativeEvent:{error:'Network connection lost'}});});
  expect(tree.root.findByType(Image).props.source).toBe(42);
  expect(tree.root.findByType(Image).props.onError).toBeUndefined();
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(console.warn.mock.calls[0][1].error).toBe('Network connection lost');
});
it('never submits empty URI strings or objects to either native loader',()=>{
  for(const source of ['', '  ', {uri:''}, {uri:'  '}, undefined]) {
    mount(source);
    expect(tree.root.findByType(Image).props.source).toBe(42);
    renderer.act(()=>tree.unmount());tree=null;
  }
  renderer.act(()=>{tree=renderer.create(React.createElement(BasicImage,{uri:' ',emptySrc:42}));});
  expect(tree.root.findByType(Image).props.source).toBe(42);
});
