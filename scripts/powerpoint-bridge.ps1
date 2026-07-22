param([Parameter(Mandatory=$true)][string]$RequestPath)

$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)

$msoTrue=-1;$msoFalse=0;$msoTextOrientationHorizontal=1
$msoShapeRectangle=1;$msoShapeRoundedRectangle=5;$msoShapeOval=9;$msoShapeIsoscelesTriangle=7
$msoShapeDiamond=4;$msoShapeHexagon=10;$msoShapeParallelogram=2;$msoShapeCloud=179
$msoConnectorStraight=1;$msoConnectorElbow=2;$msoConnectorCurve=3
$msoAnchorTop=1;$msoAnchorMiddle=3;$msoAnchorBottom=4
$ppAlignLeft=1;$ppAlignCenter=2;$ppAlignRight=3
$ppLayoutBlank=12;$ppSaveAsOpenXMLPresentation=24;$ppSaveAsPDF=32

function Has($o,[string]$name){$null -ne $o -and $null -ne $o.PSObject.Properties[$name]}
function Val($o,[string]$name,$default=$null){if(Has $o $name){$o.$name}else{$default}}
function RgbFrom([object]$value,[int]$default=0){
    if($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)){return $default}
    if($value -is [int] -or $value -is [long]){return [int]$value}
    $s=([string]$value).Trim()
    if($s.StartsWith('#')){$s=$s.Substring(1)}
    if($s -match '^[0-9A-Fa-f]{6}$'){
        $r=[Convert]::ToInt32($s.Substring(0,2),16);$g=[Convert]::ToInt32($s.Substring(2,2),16);$b=[Convert]::ToInt32($s.Substring(4,2),16)
        return [int]($r+256*$g+65536*$b)
    }
    if($s -match '^\d+$'){return [int]$s}
    throw "Invalid color '$value'. Use #RRGGBB or a PowerPoint RGB integer."
}
function HexFromRgb([int]$rgb){
    $r=$rgb -band 255;$g=($rgb -shr 8) -band 255;$b=($rgb -shr 16) -band 255
    return ('#{0:X2}{1:X2}{2:X2}' -f $r,$g,$b)
}
function Get-App([bool]$create=$true){
    try{$app=[Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')}
    catch{if(!$create){throw 'PowerPoint is not running.'};$app=New-Object -ComObject PowerPoint.Application}
    return $app
}
function Find-Pres($app,[string]$path=''){
    if($path){$full=[IO.Path]::GetFullPath($path);foreach($p in $app.Presentations){try{if([IO.Path]::GetFullPath($p.FullName) -ieq $full){return $p}}catch{}};return $null}
    try{if($app.Presentations.Count -gt 0){$active=$app.ActivePresentation;if($active){return $active};return $app.Presentations.Item($app.Presentations.Count)}}catch{}
    return $null
}
function Get-Slide($pres,[int]$index=0){
    if(!$pres){throw 'No PowerPoint presentation is active.'}
    if($index -le 0){try{$index=[int]$pres.SlideShowWindow.View.Slide.SlideIndex}catch{$index=1};if($index -le 0){$index=1}}
    if($index -lt 1 -or $index -gt $pres.Slides.Count){throw "Slide index $index is out of range (1-$($pres.Slides.Count))."}
    return $pres.Slides.Item($index)
}
function ShapeByName($slide,[string]$name){try{return $slide.Shapes.Item($name)}catch{throw "Shape not found: $name"}}
function UniqueName($slide,[string]$requested,[string]$prefix){
    $name=if($requested){$requested}else{"$prefix-$([guid]::NewGuid().ToString('N').Substring(0,8))"}
    try{$null=$slide.Shapes.Item($name);throw "Shape name already exists: $name"}catch{if($_.Exception.Message -like 'Shape name already exists*'){throw}}
    return $name
}
function ShapeType([string]$type){
    switch(($type+'').ToLowerInvariant()){
        'rectangle'{$msoShapeRectangle};'rounded'{$msoShapeRoundedRectangle};'ellipse'{$msoShapeOval};'oval'{$msoShapeOval}
        'triangle'{$msoShapeIsoscelesTriangle};'diamond'{$msoShapeDiamond};'hexagon'{$msoShapeHexagon}
        'parallelogram'{$msoShapeParallelogram};'cloud'{$msoShapeCloud};default{$msoShapeRoundedRectangle}
    }
}
function Apply-Line($shape,$spec){
    $visible=Val $spec 'line_visible' $true;$shape.Line.Visible=if($visible){$msoTrue}else{$msoFalse}
    if($visible){
        $shape.Line.ForeColor.RGB=RgbFrom (Val $spec 'line_color' '#17345B')
        $shape.Line.Weight=[single](Val $spec 'line_width' 1.5)
        if(Val $spec 'dashed' $false){$shape.Line.DashStyle=4}
    }
}
function Apply-Fill($shape,$spec){
    $visible=Val $spec 'fill_visible' $true;$shape.Fill.Visible=if($visible){$msoTrue}else{$msoFalse}
    if($visible){$shape.Fill.ForeColor.RGB=RgbFrom (Val $spec 'fill_color' '#EEF4FC');$shape.Fill.Transparency=[single](Val $spec 'fill_transparency' 0)}
}
function AlignValue([string]$value){switch(($value+'').ToLowerInvariant()){'left'{$ppAlignLeft};'right'{$ppAlignRight};default{$ppAlignCenter}}}
function AnchorValue([string]$value){switch(($value+'').ToLowerInvariant()){'top'{$msoAnchorTop};'bottom'{$msoAnchorBottom};default{$msoAnchorMiddle}}}
function Apply-Text($shape,$spec){
    if(!(Has $spec 'text')){return}
    $shape.TextFrame.TextRange.Text=[string]$spec.text
    $shape.TextFrame.TextRange.Font.Name=[string](Val $spec 'font_name' 'Aptos')
    $shape.TextFrame.TextRange.Font.Size=[single](Val $spec 'font_size' 18)
    $shape.TextFrame.TextRange.Font.Bold=if(Val $spec 'bold' $false){$msoTrue}else{$msoFalse}
    $shape.TextFrame.TextRange.Font.Italic=if(Val $spec 'italic' $false){$msoTrue}else{$msoFalse}
    $shape.TextFrame.TextRange.Font.Color.RGB=RgbFrom (Val $spec 'font_color' '#0B0B0B')
    $shape.TextFrame.TextRange.ParagraphFormat.Alignment=AlignValue (Val $spec 'align' 'center')
    $shape.TextFrame.VerticalAnchor=AnchorValue (Val $spec 'vertical_align' 'middle')
    $shape.TextFrame.WordWrap=$msoTrue;$shape.TextFrame.AutoSize=0
    $margin=[single](Val $spec 'margin' 2)
    $shape.TextFrame.MarginLeft=[single](Val $spec 'margin_left' $margin);$shape.TextFrame.MarginRight=[single](Val $spec 'margin_right' $margin)
    $shape.TextFrame.MarginTop=[single](Val $spec 'margin_top' $margin);$shape.TextFrame.MarginBottom=[single](Val $spec 'margin_bottom' $margin)
}
function ShapeInfo($shape,[bool]$includeText=$true){
    $text='';if($includeText){try{if($shape.HasTextFrame -eq $msoTrue -and $shape.TextFrame.HasText -eq $msoTrue){$text=$shape.TextFrame.TextRange.Text}}catch{}}
    $fill=$null;$line=$null;try{if($shape.Fill.Visible -eq $msoTrue){$fill=HexFromRgb $shape.Fill.ForeColor.RGB}}catch{}
    try{if($shape.Line.Visible -eq $msoTrue){$line=HexFromRgb $shape.Line.ForeColor.RGB}}catch{}
    [ordered]@{name=$shape.Name;type=[int]$shape.Type;left=[math]::Round($shape.Left,2);top=[math]::Round($shape.Top,2);width=[math]::Round($shape.Width,2);height=[math]::Round($shape.Height,2);rotation=[math]::Round($shape.Rotation,2);text=$text;fill_color=$fill;line_color=$line;z_order=[int]$shape.ZOrderPosition}
}
function PresentationInfo($app,$pres,$slide){
    [ordered]@{powerpoint_version=[string]$app.Version;visible=($app.Visible -eq $msoTrue);presentation=if($pres){$pres.Name}else{$null};path=if($pres){$pres.FullName}else{$null};saved=if($pres){$pres.Saved -eq $msoTrue}else{$null};slides=if($pres){$pres.Slides.Count}else{0};slide_index=if($slide){$slide.SlideIndex}else{$null};slide_width=if($pres){[math]::Round($pres.PageSetup.SlideWidth,2)}else{$null};slide_height=if($pres){[math]::Round($pres.PageSetup.SlideHeight,2)}else{$null};shapes=if($slide){$slide.Shapes.Count}else{0};control_scope='PowerPoint COM object model only'}
}
function Ensure-Output([string]$path,[bool]$overwrite,[string]$extension=''){
    $full=[IO.Path]::GetFullPath($path)
    if($extension -and [IO.Path]::GetExtension($full).ToLowerInvariant() -ne $extension){throw "Output path must end with $extension"}
    if((Test-Path -LiteralPath $full) -and !$overwrite){throw "Output exists; pass overwrite=true: $full"}
    $dir=Split-Path -Parent $full;if($dir -and !(Test-Path -LiteralPath $dir)){New-Item -ItemType Directory -Path $dir -Force|Out-Null}
    return $full
}
function Add-Shape($slide,$a){
    $name=UniqueName $slide ([string](Val $a 'name' '')) 'shape'
    $shape=$slide.Shapes.AddShape((ShapeType ([string](Val $a 'shape_type' 'rounded'))),[single]$a.x,[single]$a.y,[single]$a.width,[single]$a.height)
    $shape.Name=$name;Apply-Fill $shape $a;Apply-Line $shape $a;Apply-Text $shape $a
    if(Has $a 'rotation'){$shape.Rotation=[single]$a.rotation};return ShapeInfo $shape
}
function Add-Text($slide,$a){
    $name=UniqueName $slide ([string](Val $a 'name' '')) 'text'
    $shape=$slide.Shapes.AddTextBox($msoTextOrientationHorizontal,[single]$a.x,[single]$a.y,[single]$a.width,[single]$a.height)
    $shape.Name=$name;$shape.Fill.Visible=$msoFalse;$shape.Line.Visible=$msoFalse
    if(!(Has $a 'text')){$a|Add-Member -NotePropertyName text -NotePropertyValue ''};Apply-Text $shape $a
    if(Val $a 'fill_visible' $false){Apply-Fill $shape $a};if(Val $a 'line_visible' $false){Apply-Line $shape $a};return ShapeInfo $shape
}
function Add-Line($slide,$a,[bool]$connector=$false){
    $prefix='line';if($connector){$prefix='connector'}
    $name=UniqueName $slide ([string](Val $a 'name' '')) $prefix
    if($connector){
        $kind=switch(([string](Val $a 'connector_type' 'elbow')).ToLowerInvariant()){'straight'{$msoConnectorStraight};'curve'{$msoConnectorCurve};default{$msoConnectorElbow}}
        $shape=$slide.Shapes.AddConnector($kind,[single]$a.x1,[single]$a.y1,[single]$a.x2,[single]$a.y2)
        $src=ShapeByName $slide ([string]$a.source);$dst=ShapeByName $slide ([string]$a.target)
        $shape.ConnectorFormat.BeginConnect($src,[int](Val $a 'source_site' 1));$shape.ConnectorFormat.EndConnect($dst,[int](Val $a 'target_site' 1));$shape.RerouteConnections()
    }else{$shape=$slide.Shapes.AddLine([single]$a.x1,[single]$a.y1,[single]$a.x2,[single]$a.y2)}
    $shape.Name=$name;$shape.Line.ForeColor.RGB=RgbFrom (Val $a 'color' '#17345B');$shape.Line.Weight=[single](Val $a 'width' 1.8)
    if(Val $a 'dashed' $false){$shape.Line.DashStyle=4}
    $start=[string](Val $a 'start_arrow' 'none');$end=[string](Val $a 'end_arrow' 'triangle')
    $shape.Line.BeginArrowheadStyle=if($start -eq 'none'){1}else{3};$shape.Line.EndArrowheadStyle=if($end -eq 'none'){1}else{3}
    return ShapeInfo $shape $false
}
function Add-Picture($slide,$a){
    $path=[IO.Path]::GetFullPath([string]$a.path);if(!(Test-Path -LiteralPath $path)){throw "Image not found: $path"}
    $name=UniqueName $slide ([string](Val $a 'name' '')) 'picture'
    $shape=$slide.Shapes.AddPicture($path,$msoFalse,$msoTrue,[single]$a.x,[single]$a.y,[single](Val $a 'width' -1),[single](Val $a 'height' -1));$shape.Name=$name
    if(Has $a 'rotation'){$shape.Rotation=[single]$a.rotation};return ShapeInfo $shape $false
}
function Update-Shape($slide,$a){
    $s=ShapeByName $slide ([string]$a.name)
    foreach($pair in @(@('x','Left'),@('y','Top'),@('width','Width'),@('height','Height'),@('rotation','Rotation'))){if(Has $a $pair[0]){$s.($pair[1])=[single]$a.($pair[0])}}
    if(Has $a 'new_name'){$s.Name=[string]$a.new_name}
    if(Has $a 'fill_visible'){$s.Fill.Visible=if($a.fill_visible){$msoTrue}else{$msoFalse}}
    if(Has $a 'fill_color'){$s.Fill.Visible=$msoTrue;$s.Fill.ForeColor.RGB=RgbFrom $a.fill_color}
    if(Has $a 'fill_transparency'){$s.Fill.Transparency=[single]$a.fill_transparency}
    if(Has $a 'line_visible'){$s.Line.Visible=if($a.line_visible){$msoTrue}else{$msoFalse}}
    if(Has $a 'line_color'){$s.Line.Visible=$msoTrue;$s.Line.ForeColor.RGB=RgbFrom $a.line_color}
    if(Has $a 'line_width'){$s.Line.Weight=[single]$a.line_width}
    if(Has $a 'dashed'){$s.Line.DashStyle=if($a.dashed){4}else{1}}
    if(Has $a 'text'){$s.TextFrame.TextRange.Text=[string]$a.text}
    if(Has $a 'font_name'){$s.TextFrame.TextRange.Font.Name=[string]$a.font_name}
    if(Has $a 'font_size'){$s.TextFrame.TextRange.Font.Size=[single]$a.font_size}
    if(Has $a 'font_color'){$s.TextFrame.TextRange.Font.Color.RGB=RgbFrom $a.font_color}
    if(Has $a 'bold'){$s.TextFrame.TextRange.Font.Bold=if($a.bold){$msoTrue}else{$msoFalse}}
    if(Has $a 'italic'){$s.TextFrame.TextRange.Font.Italic=if($a.italic){$msoTrue}else{$msoFalse}}
    if(Has $a 'align'){$s.TextFrame.TextRange.ParagraphFormat.Alignment=AlignValue $a.align}
    if(Has $a 'vertical_align'){$s.TextFrame.VerticalAnchor=AnchorValue $a.vertical_align}
    if(Has $a 'margin'){$m=[single]$a.margin;$s.TextFrame.MarginLeft=$m;$s.TextFrame.MarginRight=$m;$s.TextFrame.MarginTop=$m;$s.TextFrame.MarginBottom=$m}
    foreach($pair in @(@('margin_left','MarginLeft'),@('margin_right','MarginRight'),@('margin_top','MarginTop'),@('margin_bottom','MarginBottom'))){if(Has $a $pair[0]){$s.TextFrame.($pair[1])=[single]$a.($pair[0])}}
    if(Has $a 'z_order'){if(([string]$a.z_order).ToLowerInvariant() -eq 'front'){$s.ZOrder(0)}else{$s.ZOrder(1)}}
    return ShapeInfo $s
}
function Execute-Operation($slide,$op){
    switch(([string]$op.type).ToLowerInvariant()){
        'shape'{Add-Shape $slide $op};'text'{Add-Text $slide $op};'line'{Add-Line $slide $op $false};'connector'{Add-Line $slide $op $true}
        'picture'{Add-Picture $slide $op};'update'{Update-Shape $slide $op}
        'delete'{$name=[string]$op.name;(ShapeByName $slide $name).Delete();[ordered]@{deleted=$name}}
        'wait'{$ms=[math]::Max(0,[math]::Min(10000,[int](Val $op 'ms' 100)));Start-Sleep -Milliseconds $ms;[ordered]@{waited_ms=$ms}}
        default{throw "Unsupported operation type: $($op.type)"}
    }
}

try{
    $request=Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8|ConvertFrom-Json
    $action=[string]$request.action;$a=$request.args
    $targetPath=[string](Val $a 'presentation_path' '')
    $app=Get-App (($action -in @('launch','new_presentation')) -or [bool]$targetPath)
    $pres=Find-Pres $app $targetPath
    $openedHere=$false
    if(!$pres -and $targetPath){
        $fullTarget=[IO.Path]::GetFullPath($targetPath);if(!(Test-Path -LiteralPath $fullTarget)){throw "Presentation not found: $fullTarget"}
        $readOnly=$action -in @('inspect','validate','export_slide','export_pdf')
        $openReadOnly=$msoFalse;if($readOnly){$openReadOnly=$msoTrue}
        $openWithWindow=$msoFalse;if(Val $a 'with_window' $false){$openWithWindow=$msoTrue}
        $pres=$app.Presentations.Open($fullTarget,$openReadOnly,$msoFalse,$openWithWindow);$openedHere=$true
    }
    $slide=$null;if($pres){$slide=Get-Slide $pres ([int](Val $a 'slide_index' 0))}
    switch($action){
        'launch'{
            $app.Visible=$msoTrue
            $open=[string](Val $a 'file_path' '')
            if($open){$full=[IO.Path]::GetFullPath($open);$pres=Find-Pres $app $full;if(!$pres){$pres=$app.Presentations.Open($full,$msoFalse,$msoFalse,$msoTrue)}}
            elseif(!$pres -and (Val $a 'create_if_missing' $true)){$pres=$app.Presentations.Add($msoTrue);$pres.PageSetup.SlideWidth=[single](Val $a 'slide_width' 960);$pres.PageSetup.SlideHeight=[single](Val $a 'slide_height' 540);$null=$pres.Slides.Add(1,$ppLayoutBlank)}
            $slide=if($pres){Get-Slide $pres ([int](Val $a 'slide_index' 0))}else{$null}
            if(Val $a 'maximize' $true){try{$app.WindowState=3}catch{}}
            $result=PresentationInfo $app $pres $slide
        }
        'status'{$result=PresentationInfo $app $pres $slide}
        'new_presentation'{
            $app.Visible=$msoTrue;$pres=$app.Presentations.Add($msoTrue);$pres.PageSetup.SlideWidth=[single](Val $a 'slide_width' 960);$pres.PageSetup.SlideHeight=[single](Val $a 'slide_height' 540)
            $count=[math]::Max(1,[int](Val $a 'slides' 1));for($i=1;$i -le $count;$i++){$null=$pres.Slides.Add($i,$ppLayoutBlank)};$slide=$pres.Slides.Item(1);$result=PresentationInfo $app $pres $slide
        }
        'add_slide'{
            $index=[int](Val $a 'index' ($pres.Slides.Count+1));$slide=$pres.Slides.Add($index,$ppLayoutBlank);$result=PresentationInfo $app $pres $slide
        }
        'add_shape'{$result=Add-Shape $slide $a}
        'add_text'{$result=Add-Text $slide $a}
        'add_line'{$result=Add-Line $slide $a $false}
        'add_connector'{$result=Add-Line $slide $a $true}
        'add_picture'{$result=Add-Picture $slide $a}
        'update_shape'{$result=Update-Shape $slide $a}
        'delete_shape'{$name=[string]$a.name;(ShapeByName $slide $name).Delete();$result=[ordered]@{deleted=$name;shapes=$slide.Shapes.Count}}
        'group_shapes'{
            $names=@($a.names);if($names.Count -lt 2){throw 'At least two shape names are required.'};$group=$slide.Shapes.Range([object[]]$names).Group();$group.Name=[string](Val $a 'name' ("group-$([guid]::NewGuid().ToString('N').Substring(0,8))"));$result=ShapeInfo $group $false
        }
        'clear'{
            if(!(Val $a 'confirm' $false)){throw 'confirm=true is required to clear a slide.'};$count=$slide.Shapes.Count;for($i=$slide.Shapes.Count;$i -ge 1;$i--){$slide.Shapes.Item($i).Delete()};$result=[ordered]@{removed=$count;slide_index=$slide.SlideIndex}
        }
        'close_presentation'{
            if(!(Val $a 'confirm' $false)){throw 'confirm=true is required to close a presentation.'}
            $closedPath=$pres.FullName
            if(Val $a 'save' $false){$pres.Save()}else{$pres.Saved=$msoTrue}
            $pres.Close();$pres=$null;$slide=$null;$result=[ordered]@{closed=$true;path=$closedPath;saved=(Val $a 'save' $false)}
        }
        'batch'{
            $delay=[math]::Max(0,[math]::Min(10000,[int](Val $a 'step_delay_ms' 100)));$results=@();$index=0
            foreach($op in @($a.operations)){$item=Execute-Operation $slide $op;$results+=,[ordered]@{index=$index;type=$op.type;result=$item};$index++;if(([string]$op.type).ToLowerInvariant() -ne 'wait' -and $delay -gt 0){Start-Sleep -Milliseconds $delay}}
            $result=[ordered]@{operations_applied=$results.Count;step_delay_ms=$delay;results=$results;slide_index=$slide.SlideIndex;shapes=$slide.Shapes.Count}
        }
        'inspect'{
            $max=[math]::Max(1,[math]::Min(5000,[int](Val $a 'max_shapes' 500)));$items=@();$limit=[math]::Min($slide.Shapes.Count,$max)
            for($i=1;$i -le $limit;$i++){$items+=,(ShapeInfo $slide.Shapes.Item($i) (Val $a 'include_text' $true))}
            $result=[ordered]@{presentation=$pres.FullName;slide_index=$slide.SlideIndex;slide_width=$pres.PageSetup.SlideWidth;slide_height=$pres.PageSetup.SlideHeight;total=$slide.Shapes.Count;truncated=($slide.Shapes.Count -gt $max);shapes=$items}
        }
        'validate'{
            $issues=@();$sw=[single]$pres.PageSetup.SlideWidth;$sh=[single]$pres.PageSetup.SlideHeight
            foreach($s in $slide.Shapes){
                if($s.Left -lt 0 -or $s.Top -lt 0 -or ($s.Left+$s.Width) -gt $sw -or ($s.Top+$s.Height) -gt $sh){$issues+=,[ordered]@{type='off_slide';shape=$s.Name;bounds=@($s.Left,$s.Top,$s.Width,$s.Height)}}
                try{if($s.HasTextFrame -eq $msoTrue -and $s.TextFrame.HasText -eq $msoTrue -and ([math]::Abs($s.Rotation % 180) -lt 0.1)){$bound=$s.TextFrame.TextRange.BoundHeight;$avail=$s.Height-$s.TextFrame.MarginTop-$s.TextFrame.MarginBottom;if($bound -gt ($avail+0.5)){$issues+=,[ordered]@{type='text_overflow';shape=$s.Name;bound_height=[math]::Round($bound,2);available_height=[math]::Round($avail,2)}}}}catch{}
            }
            $result=[ordered]@{ok=($issues.Count -eq 0);presentation=$pres.FullName;slide_index=$slide.SlideIndex;issue_count=$issues.Count;issues=$issues}
        }
        'save'{
            $out=[string](Val $a 'output_path' '')
            if($out){$full=Ensure-Output $out (Val $a 'overwrite' $false) '.pptx';$pres.SaveAs($full,$ppSaveAsOpenXMLPresentation);$result=[ordered]@{path=$full;saved=$true;bytes=(Get-Item -LiteralPath $full).Length}}
            else{$pres.Save();$result=[ordered]@{path=$pres.FullName;saved=$true;bytes=if(Test-Path -LiteralPath $pres.FullName){(Get-Item -LiteralPath $pres.FullName).Length}else{$null}}}
        }
        'export_slide'{
            $format=([string](Val $a 'format' 'PNG')).ToUpperInvariant();if($format -notin @('PNG','JPG')){throw 'format must be PNG or JPG.'}
            $ext=if($format -eq 'PNG'){'.png'}else{'.jpg'};$full=Ensure-Output ([string]$a.output_path) (Val $a 'overwrite' $false) $ext
            $width=[int](Val $a 'width_px' 2000);$height=[int](Val $a 'height_px' 0);if($height -le 0){$height=[int][math]::Round($width*$pres.PageSetup.SlideHeight/$pres.PageSetup.SlideWidth)}
            $slide.Export($full,$format,$width,$height);$result=[ordered]@{path=$full;format=$format;width_px=$width;height_px=$height;bytes=(Get-Item -LiteralPath $full).Length}
        }
        'export_pdf'{
            $full=Ensure-Output ([string]$a.output_path) (Val $a 'overwrite' $false) '.pdf';$pres.SaveAs($full,$ppSaveAsPDF);$result=[ordered]@{path=$full;format='PDF';bytes=(Get-Item -LiteralPath $full).Length}
        }
        default{throw "Unknown bridge action: $action"}
    }
    if($openedHere -and (Val $a 'close_after' $true)){try{$pres.Saved=$msoTrue;$pres.Close()}catch{}}
    [ordered]@{ok=$true;result=$result}|ConvertTo-Json -Depth 20 -Compress
}catch{
    try{if($openedHere -and $pres){$pres.Saved=$msoTrue;$pres.Close()}}catch{}
    [ordered]@{ok=$false;error=$_.Exception.Message;action=if($request){$request.action}else{$null}}|ConvertTo-Json -Depth 5 -Compress
    exit 1
}
