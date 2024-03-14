<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <title>my first pdfmake example</title>
  <script src='build/pdfmake.min.js'></script> 
  <script src='build/vfs_fonts.js'></script> 
</head>

<body>

	<button type="button" onclick="creaPDF()">Crear PDF</button>

</body>

</html>

<script type="text/javascript">

			
		


	function creaPDF()
	{

var docDefinition = {
		content: [
	'pdfmake (since it\'s based on pdfkit) supports JPEG and PNG format',
	'If no width/height/fit is provided, image original size will be used',
	
	'If you specify width, image will scale proportionally',
	
	'If you specify both width and height - image will be stretched',
	
	
	'Images can be also provided in dataURL format...',
	'or be declared in an "images" dictionary and referenced by name',
],

};
			
		pdfMake.createPdf(docDefinition).download('Report.pdf');
		
	}//close function
	
</script>